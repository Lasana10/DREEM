import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, RefreshCw, ShieldCheck, ArrowRight } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import { fetchQuestionBank,reviewQuestion,type QuestionItem } from "../lib/questionBank";
import { listExamPapers,reviewExamPaper,type SavedExamPaper } from "../lib/examPapers";
import { listWeeklyRegisters,listMarkingChecks,reviewWeeklyRegister,type WeeklyRegister,type MarkingCheck } from "../lib/weeklyRegisters";
import { isoLocalDate,weekStart } from "../lib/academicWeek";
import { buildAcademicQueue,type AcademicQueueArea } from "../lib/academicQueue";
import { userFacingError } from "../lib/userFacingError";

type ReviewDecision="approved"|"returned";
export default function AcademicActionQueue({workspace,onOpen}:{workspace:WorkspaceData;onOpen:(area:AcademicQueueArea)=>void}){
 const [questions,setQuestions]=useState<QuestionItem[]>([]),[papers,setPapers]=useState<SavedExamPaper[]>([]);
 const [registers,setRegisters]=useState<WeeklyRegister[]>([]),[checks,setChecks]=useState<MarkingCheck[]>([]);
 const [loading,setLoading]=useState(true),[busyId,setBusyId]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [decisions,setDecisions]=useState<Record<string,ReviewDecision>>({}),[notes,setNotes]=useState<Record<string,string>>({});
 const reload=useCallback(async()=>{
  setLoading(true);
  try{
   const start=weekStart(isoLocalDate(new Date()));
   const [q,p,r]=await Promise.all([fetchQuestionBank(),listExamPapers(),listWeeklyRegisters(start)]);
   const marking=await listMarkingChecks(r.map(item=>item.id));
   setQuestions(q);setPapers(p);setRegisters(r);setChecks(marking);setError("");
  }catch(reason){setError(userFacingError(reason,"Academic review evidence could not be loaded. Check the school connection and retry."));}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void reload();},[reload]);
 const items=useMemo(()=>buildAcademicQueue({lessonPlans:workspace.academics.lessonPlans,assessments:workspace.academics.assessments,
  questions,papers,registers,checks,viewerId:workspace.viewer.id}),[workspace,questions,papers,registers,checks]);
 async function decide(id:string,kind:"question"|"paper"|"weekly_register"){
  const note=(notes[id]??"").trim(),decision=decisions[id]??"approved";
  if(note.length<5){setError("Explain your review findings in at least five characters.");return;}
  setError("");setNotice("");setBusyId(id);
  try{
   if(kind==="question")await reviewQuestion(id,decision,note);
   if(kind==="paper")await reviewExamPaper(id,decision,note);
   if(kind==="weekly_register")await reviewWeeklyRegister(id,decision,note);
   setNotice("Independent academic decision recorded.");await reload();
  }catch(reason){setError(userFacingError(reason,"The review was not recorded."));}
  finally{setBusyId("");}
 }
 return <section className="excellence-queue" aria-label="Academic decisions requiring attention">
  <div className="excellence-register-header"><div>
   <span className="excellence-kicker-dark"><ShieldCheck size={15}/> ACADEMIC LEADERSHIP · DECISION CENTRE</span>
   <h2>What needs my attention?</h2>
   <p>Live review items from existing approved school workflows. Decisions are recorded in their original systems—not a separate task database.</p>
  </div><button type="button" className="excellence-cancel" disabled={loading} onClick={()=>void reload()}><RefreshCw size={15}/> Refresh</button></div>
  {error&&<p className="form-status error" role="alert">{error}</p>}{notice&&<p className="form-status success" role="status">{notice}</p>}
  {loading?<p role="status">Loading academic decisions…</p>:
   <><div className="excellence-queue-summary"><strong>{items.length}</strong> current actions requiring attention <small>Weekly marking checks cover the current teaching week. Lesson and assessment queues use currently loaded school records.</small></div>
   {items.length===0?<p className="excellence-queue-empty"><ClipboardCheck size={19}/> No pending academic decisions are visible in the current records.</p>:
   <div className="excellence-queue-items">{items.map(item=><article key={item.kind+item.id}>
    <div><span className="excellence-queue-type">{item.kind.replace("_"," ")}</span><strong>{item.title}</strong><small>{item.detail}</small></div>
    {["question","paper","weekly_register"].includes(item.kind)?
    <div className="excellence-queue-decision"><label>Decision<select aria-label={`Decision for ${item.title}`} value={decisions[item.id]??"approved"} onChange={e=>setDecisions(current=>({...current,[item.id]:e.target.value as ReviewDecision}))}><option value="approved">Approve after verification</option><option value="returned">Return for correction</option></select></label><label>Evidence / reason<input aria-label={`Review findings for ${item.title}`} value={notes[item.id]??""} onChange={e=>setNotes(current=>({...current,[item.id]:e.target.value}))} placeholder="What was checked or must change?"/></label><button type="button" disabled={!!busyId} onClick={()=>void decide(item.id,item.kind as "question"|"paper"|"weekly_register")}>{busyId===item.id?"Saving…":"Record decision"}</button></div>:
    <button type="button" className="excellence-cancel" onClick={()=>onOpen(item.area)}>Open workflow <ArrowRight size={15}/></button>}
   </article>)}</div>}
   </>}
 </section>;
}
