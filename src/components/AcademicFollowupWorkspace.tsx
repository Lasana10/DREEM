import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
import {CheckCircle2,ClipboardList,RefreshCw,ShieldCheck} from "lucide-react";
import type {WorkspaceData} from "../lib/repository";
import {listMarkingChecks,type WeeklyRegister,type MarkingCheck} from "../lib/weeklyRegisters";
import {listAcademicFollowups,openAcademicFollowup,respondAcademicFollowup,reviewAcademicFollowup,type AcademicFollowup} from "../lib/academicFollowups";
import {userFacingError} from "../lib/userFacingError";
import {isoLocalDate} from "../lib/academicWeek";

export default function AcademicFollowupWorkspace({workspace,registers,reviewer}:{workspace:WorkspaceData;registers:WeeklyRegister[];reviewer:boolean}){
 const [checks,setChecks]=useState<MarkingCheck[]>([]);
 const [actions,setActions]=useState<AcademicFollowup[]>([]),[busy,setBusy]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [registerId,setRegisterId]=useState(""),[checkId,setCheckId]=useState("");
 const [responseNotes,setResponseNotes]=useState<Record<string,string>>({}),[responseEvidence,setResponseEvidence]=useState<Record<string,string>>({});
 const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({}),[reviewDecisions,setReviewDecisions]=useState<Record<string,"closed"|"returned">>({});
 const viewerId=workspace.viewer.id;
 const registerIds=registers.map(x=>x.id).join(",");
 useEffect(()=>{let active=true;listMarkingChecks(registerIds?registerIds.split(","):[]).then(rows=>{if(active)setChecks(rows);}).catch(reason=>{if(active)setError(userFacingError(reason,"Marking check evidence could not be loaded."));});return()=>{active=false;};},[registerIds]);
 const accessibleRegisters=useMemo(()=>registers.filter(x=>x.submitted_by!==viewerId),[registers,viewerId]);
 const selectedRegister=accessibleRegisters.find(x=>x.id===registerId)??accessibleRegisters[0];
 const relatedChecks=checks.filter(x=>x.register_id===selectedRegister?.id);
 const reload=useCallback(async()=>{setLoading(true);try{setActions(await listAcademicFollowups());setError("");}catch(reason){setError(userFacingError(reason,"Could not load academic follow-up actions."));}finally{setLoading(false);}},[]);
 useEffect(()=>{void reload();},[reload]);
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!selectedRegister)return;
  const form=event.currentTarget,data=new FormData(form);
  setBusy("create");setError("");setMessage("");
  try{
   await openAcademicFollowup({registerId:selectedRegister.id,markingCheckId:checkId||undefined,title:String(data.get("title")??"").trim(),action:String(data.get("action")??"").trim(),dueDate:String(data.get("due")??"")});
   setMessage("Corrective teaching action assigned to the submitting teacher.");form.reset();setCheckId("");await reload();
  }catch(reason){setError(userFacingError(reason,"The academic follow-up was not created."));}finally{setBusy("");}
 }
 async function respond(item:AcademicFollowup){
  setBusy(item.id);setError("");setMessage("");
  try{
   await respondAcademicFollowup(item.id,responseNotes[item.id]??"",responseEvidence[item.id]??"");
   setMessage("Your corrective action and evidence have been submitted for independent review.");await reload();
  }catch(reason){setError(userFacingError(reason,"Your response was not saved."));}finally{setBusy("");}
 }
 async function review(item:AcademicFollowup){
  setBusy(item.id);setError("");setMessage("");
  try{
   await reviewAcademicFollowup(item.id,reviewDecisions[item.id]??"closed",reviewNotes[item.id]??"");
   setMessage("Independent review of corrective action recorded.");await reload();
  }catch(reason){setError(userFacingError(reason,"Corrective action review was not recorded."));}finally{setBusy("");}
 }
 const active=actions.filter(x=>x.status!=="closed");
 return <section className="excellence-followups" aria-label="Academic corrective action follow-through">
  <div className="excellence-register-header"><div><span className="excellence-kicker-dark"><ShieldCheck size={15}/> ACADEMIC QUALITY · FOLLOW-THROUGH</span><h2>Corrective teaching actions</h2><p>Assign a concrete improvement from weekly supervision, receive teacher evidence and independently verify closure. This is a supportive academic process, not a payroll or disciplinary sanction.</p></div>
  <button type="button" className="excellence-cancel" onClick={()=>void reload()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
  {error&&<p className="form-status error" role="alert">{error}</p>}{message&&<p className="form-status success" role="status">{message}</p>}
  {reviewer&&accessibleRegisters.length>0&&<form className="excellence-followup-create" onSubmit={e=>void create(e)}>
   <h3>Assign an evidence-based improvement</h3><div className="excellence-register-fields">
   <label>Weekly register<select value={selectedRegister?.id??""} onChange={e=>{setRegisterId(e.target.value);setCheckId("");}}>{accessibleRegisters.map(r=><option key={r.id} value={r.id}>{r.week_start} · {workspace.academics.assignments.find(a=>a.id===r.teaching_assignment_id)?.className??"Assigned class"}</option>)}</select></label>
   <label>Marking check (optional)<select value={checkId} onChange={e=>setCheckId(e.target.value)}><option value="">General weekly review</option>{relatedChecks.map(x=><option key={x.id} value={x.id}>{x.decision.replace("_"," ")} · {x.sampled_books} sampled</option>)}</select></label>
   <label>Due date<input type="date" name="due" min={isoLocalDate(new Date())} required/></label></div>
   <label>Required improvement title<input name="title" minLength={5} maxLength={160} required placeholder="e.g. Correct outstanding workbook marking"/></label>
   <label>Action and expected evidence<textarea name="action" rows={3} minLength={10} maxLength={2000} required placeholder="Specific correction, learning support or marking evidence expected"/></label>
   <button className="excellence-register-action" type="submit" disabled={!!busy}>Assign corrective action</button>
  </form>}
  {loading?<p role="status">Loading follow-up work…</p>:<>
   <div className="excellence-followup-count"><ClipboardList size={17}/><strong>{active.length}</strong> open, awaiting review or returned actions</div>
   {actions.length===0?<p className="excellence-queue-empty">No academic follow-up actions are recorded for your accessible school work.</p>:
   <div className="excellence-followup-list">{actions.map(item=>{
    const overdue=item.status!=="closed"&&item.due_date<isoLocalDate(new Date());
    return <article className="excellence-register-item" key={item.id}>
     <div className="excellence-register-item-top"><div><strong>{item.title}</strong><small>Due {item.due_date}{overdue?" · OVERDUE":""} · Assigned to {workspace.academics.assignments.find(a=>registers.some(r=>r.id===item.register_id&&r.teaching_assignment_id===a.id))?.teacherName??"Teacher"}</small></div><span className={"excellence-register-state "+(overdue?"excellence-overdue":"")}>{item.status}</span></div>
     <p><strong>Required improvement:</strong> {item.required_action}</p>
     {item.response&&<p><strong>Teacher response:</strong> {item.response}{item.response_evidence?" · Evidence: "+item.response_evidence:""}</p>}
     {item.review_note&&<p><strong>Review findings:</strong> {item.review_note}</p>}
     {item.assigned_teacher===viewerId&&(item.status==="open"||item.status==="returned")&&
      <div className="excellence-followup-response"><label>What was completed?<textarea minLength={10} maxLength={2000} rows={2} value={responseNotes[item.id]??""} onChange={e=>setResponseNotes(x=>({...x,[item.id]:e.target.value}))} placeholder="Describe your actual corrective work"/></label><label>Evidence reference<input minLength={5} maxLength={1000} value={responseEvidence[item.id]??""} onChange={e=>setResponseEvidence(x=>({...x,[item.id]:e.target.value}))} placeholder="Exercise book pages, lesson evidence or document reference"/></label><button type="button" className="excellence-register-action" disabled={!!busy||(responseNotes[item.id]??"").trim().length<10||(responseEvidence[item.id]??"").trim().length<5} onClick={()=>void respond(item)}>Submit evidence for review</button></div>}
     {reviewer&&item.assigned_teacher!==viewerId&&item.status==="responded"&&<div className="excellence-register-review"><label>Review<select value={reviewDecisions[item.id]??"closed"} onChange={e=>setReviewDecisions(x=>({...x,[item.id]:e.target.value as "closed"|"returned"}))}><option value="closed">Verified — close action</option><option value="returned">Further correction needed</option></select></label><label>Verification findings<input minLength={10} value={reviewNotes[item.id]??""} onChange={e=>setReviewNotes(x=>({...x,[item.id]:e.target.value}))} placeholder="What evidence did you independently inspect?"/></label><button type="button" disabled={!!busy||(reviewNotes[item.id]??"").trim().length<10} onClick={()=>void review(item)}><CheckCircle2 size={16}/> Record verification</button></div>}
    </article>;
   })}</div>}
  </>}
 </section>;
}
