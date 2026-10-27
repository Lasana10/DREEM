import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BookCheck, CheckCircle2, RotateCcw, Send } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import { listWeeklyRegisters, reviewWeeklyRegister, submitWeeklyRegister, type WeeklyRegister } from "../lib/weeklyRegisters";
import { userFacingError } from "../lib/userFacingError";
import { weekStart } from "../lib/academicWeek";
import MarkingVerificationPanel from "./MarkingVerificationPanel";

const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
export default function WeeklyRegisterWorkspace({workspace,teacher,reviewer}:{workspace:WorkspaceData;teacher:boolean;reviewer:boolean}){
 const [week,setWeek]=useState(()=>weekStart(today()));
 const [rows,setRows]=useState<WeeklyRegister[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [assignmentId,setAssignmentId]=useState(""),[reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
 const [decision,setDecision]=useState<Record<string,"approved"|"returned">>({});
 const assignments=useMemo(()=>workspace.academics.assignments.filter(x=>x.status==="active"&&(!teacher||reviewer||x.teacherUserId===workspace.viewer.id)),[workspace,teacher,reviewer]);
 const ownAssignments=assignments.filter(x=>x.teacherUserId===workspace.viewer.id);
 const reload=useCallback(async()=>{setLoading(true);setError("");try{setRows(await listWeeklyRegisters(week));}catch(reason){setError(userFacingError(reason,"Could not load weekly registers. The database migration may not be installed."));}finally{setLoading(false);}},[week]);
 useEffect(()=>{void reload();},[reload]);
 const selected=ownAssignments.find(x=>x.id===assignmentId)??ownAssignments[0];
 const existing=selected?rows.find(x=>x.teaching_assignment_id===selected.id):undefined;
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!selected)return;
  const form=event.currentTarget,values=new FormData(form);setSaving(true);setError("");setMessage("");
  try{
   await submitWeeklyRegister({assignmentId:selected.id,weekStart:week,
    lessonsDelivered:Number(values.get("delivered")),exercisesAssigned:Number(values.get("exercises")),
    markingState:String(values.get("marking")) as WeeklyRegister["marking_state"],
    curriculumProgress:String(values.get("progress")??"").trim(),learnerDifficulties:String(values.get("difficulties")??""),
    evidenceReference:String(values.get("evidence")??""),teacherNote:String(values.get("note")??"")});
   setMessage("Weekly register submitted to school leadership.");await reload();
  }catch(reason){setError(userFacingError(reason,"Weekly submission failed. No success has been assumed."));}
  finally{setSaving(false);}
 }
 async function review(row:WeeklyRegister){
  const choice=decision[row.id]??"approved",note=(reviewNotes[row.id]??"").trim();
  if(note.length<5){setError("Please explain your review in at least five characters.");return;}
  setSaving(true);setMessage("");setError("");
  try{await reviewWeeklyRegister(row.id,choice,note);setMessage("Academic review recorded.");await reload();}
  catch(reason){setError(userFacingError(reason,"The review was not saved."));}finally{setSaving(false);}
 }
 return <section className="excellence-register">
  <div className="excellence-register-header"><div><span className="excellence-kicker-dark"><BookCheck size={15}/> WEEKLY SUBMISSION & CONTROL</span><h2>Teaching register</h2><p>Teacher declarations require an independent leadership decision. Existing lessons and school identifiers remain unchanged.</p></div><label>Week of<input type="date" value={week} onChange={e=>e.target.value&&setWeek(weekStart(e.target.value))}/></label></div>
  {error&&<p className="form-status error" role="alert">{error}</p>}{message&&<p className="form-status success" role="status">{message}</p>}
  {teacher&&ownAssignments.length>0&&<div className="excellence-register-form"><h3>Submit my weekly work</h3><label>Teaching assignment<select aria-label="Teaching assignment" value={selected?.id??""} onChange={e=>setAssignmentId(e.target.value)}>{ownAssignments.map(item=><option value={item.id} key={item.id}>{item.className} · {item.subjectName}</option>)}</select></label>
   {existing&&existing.status!=="returned"?<p className="excellence-register-status"><CheckCircle2 size={17}/> This week's register is {existing.status}. No duplicate submission is permitted.</p>:
   <form key={selected?.id+week+existing?.status} onSubmit={submit}>
    {existing?.status==="returned"&&<p className="excellence-register-status">Returned for correction: {existing.review_note}</p>}
    <div className="excellence-register-fields"><label>Lessons delivered<input type="number" name="delivered" required min={0} max={40} defaultValue={existing?.lessons_delivered??0}/></label><label>Exercises assigned<input type="number" name="exercises" required min={0} max={100} defaultValue={existing?.exercises_assigned??0}/></label><label>Marking status<select name="marking" defaultValue={existing?.marking_state??"pending"}><option value="not_applicable">Not applicable</option><option value="pending">Pending</option><option value="partial">Partially marked</option><option value="completed">Completed (teacher reported)</option></select></label></div>
    <label>Curriculum progress / lessons covered<textarea required minLength={5} maxLength={2000} name="progress" rows={3} defaultValue={existing?.curriculum_progress??""} placeholder="Objectives and content actually covered this week"/></label>
    <label>Learner difficulties or support needed<textarea name="difficulties" rows={2} defaultValue={existing?.learner_difficulties??""}/></label>
    <label>Evidence reference (optional)<input name="evidence" maxLength={1000} defaultValue={existing?.evidence_reference??""} placeholder="Book, page, exercise or document reference"/></label>
    <label>Teacher note<input name="note" maxLength={2000} defaultValue={existing?.teacher_note??""}/></label>
    <button className="excellence-register-action" disabled={saving||loading} type="submit"><Send size={16}/> {existing?.status==="returned"?"Resubmit corrected register":"Submit weekly register"}</button>
   </form>}
  </div>}
  {reviewer&&<div className="excellence-register-queue"><h3>Headmistress / academic review</h3>{loading?<p role="status">Loading submissions…</p>:rows.length===0?<p>No weekly registers have been submitted for this week.</p>:rows.map(row=>{
   const assignment=assignments.find(x=>x.id===row.teaching_assignment_id);
   return <article key={row.id} className="excellence-register-item"><div className="excellence-register-item-top"><div><b>{assignment?assignment.className+" · "+assignment.subjectName:"School teaching assignment"}</b><small>{assignment?.teacherName??"Teacher"} · {row.lessons_delivered} lessons · {row.exercises_assigned} exercises</small></div><span className="excellence-register-state">{row.status}</span></div>
    <p><strong>Curriculum progress:</strong> {row.curriculum_progress}</p><p><strong>Marking (teacher-reported):</strong> {row.marking_state.replace("_"," ")}{row.evidence_reference?" · Evidence: "+row.evidence_reference:""}</p>{row.learner_difficulties&&<p><strong>Learning needs:</strong> {row.learner_difficulties}</p>}
    {row.status==="submitted"&&row.submitted_by!==workspace.viewer.id?<div className="excellence-register-review"><label>Decision<select aria-label="Review decision" value={decision[row.id]??"approved"} onChange={e=>setDecision(current=>({...current,[row.id]:e.target.value as "approved"|"returned"}))}><option value="approved">Approve after checking evidence</option><option value="returned">Return for correction</option></select></label><label>Review findings<input aria-label="Review findings" value={reviewNotes[row.id]??""} onChange={e=>setReviewNotes(current=>({...current,[row.id]:e.target.value}))} placeholder="Record what was verified or needs correction"/></label><button disabled={saving} onClick={()=>void review(row)}><CheckCircle2 size={16}/> Record review</button></div>:row.status==="submitted"?<p>Independent reviewer required for your own submission.</p>:<p><RotateCcw size={14}/> {row.review_note??"Review recorded"}</p>}
   </article>;
  })}</div>}
  {!loading&&<MarkingVerificationPanel registers={rows} reviewer={reviewer} viewerId={workspace.viewer.id}/>}
  <p className="excellence-weekly-disclaimer">Weekly figures and marking status are teacher declarations until reviewed against classroom evidence. Reviewing does not automatically certify exercise books or modify official pupil scores.</p>
 </section>;
}
