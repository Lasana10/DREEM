import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CalendarClock, FolderHeart, LockKeyhole, ShieldAlert } from "lucide-react";
import type { OpenStudentCaseCommand, ProgressStudentCaseCommand, StudentCaseStatus } from "../domain/types";
import { createIdempotencyKey } from "../domain/rules";
import { openStudentCase, progressStudentCase, type WorkspaceData } from "../lib/repository";

type ActionState={tone:"idle"|"success"|"error";message:string};

export default function CareView({workspace,onRefresh}:{workspace:WorkspaceData;onRefresh:()=>Promise<void>}){
  const [state,setState]=useState<ActionState>({tone:"idle",message:""});
  const [selectedCase,setSelectedCase]=useState(workspace.cases[0]?.id??"");
  const openCases=workspace.cases.filter(item=>!["resolved","closed"].includes(item.status));
  const metrics=useMemo(()=>({
    open:openCases.length,
    urgent:openCases.filter(item=>["urgent","critical"].includes(item.priority)).length,
    overdue:openCases.filter(item=>item.reviewDueOn&&item.reviewDueOn<new Date().toISOString().slice(0,10)).length,
    restricted:openCases.filter(item=>item.confidentiality==="restricted").length,
  }),[openCases]);

  async function run(action:()=>Promise<string>){
    setState({tone:"idle",message:"Saving protected case record…"});
    try{const message=await action();await onRefresh();setState({tone:"success",message});}
    catch(reason){setState({tone:"error",message:reason instanceof Error?reason.message:"The case action could not be completed."});}
  }

  async function openCase(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const formElement=event.currentTarget;
    const form=new FormData(formElement);
    const command:OpenStudentCaseCommand={
      studentId:String(form.get("studentId")??""),category:String(form.get("category")??"learning_support") as OpenStudentCaseCommand["category"],
      priority:String(form.get("priority")??"normal") as OpenStudentCaseCommand["priority"],title:String(form.get("title")??""),summary:String(form.get("summary")??""),
      reviewDueOn:String(form.get("reviewDueOn")||"")||undefined,assignedTo:String(form.get("assignedTo")||"")||undefined,idempotencyKey:createIdempotencyKey("student-case"),
    };
    await run(async()=>{const result=await openStudentCase(command);formElement.reset();setSelectedCase(result.caseId);return `Protected case ${result.caseNumber} opened.`;});
  }

  async function progressCase(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const formElement=event.currentTarget;
    const form=new FormData(formElement);
    const command:ProgressStudentCaseCommand={
      caseId:String(form.get("caseId")??""),targetStatus:String(form.get("targetStatus")??"in_progress") as StudentCaseStatus,note:String(form.get("note")??""),
      assignedTo:String(form.get("assignedTo")||"")||undefined,reviewDueOn:String(form.get("reviewDueOn")||"")||undefined,idempotencyKey:createIdempotencyKey("case-progress"),
    };
    await run(async()=>{const result=await progressStudentCase(command);formElement.reset();return `Case moved to ${result.status.replaceAll("_"," ")}.`;});
  }

  const staff=workspace.operations.memberships.filter(item=>item.status==="approved"&&!['parent','student'].includes(item.role));
  return <div className="content">
    <section className="page-intro"><div><span>CARE, SAFEGUARDING & INTERVENTIONS</span><h2>Turn concerns into owned, time-bound action.</h2><p>Restricted cases remain visible only to authorised staff. Every state change creates an immutable case event and audit evidence.</p></div><div className="care-assurance"><ShieldAlert/><span><strong>Need-to-know access</strong><small>Safeguarding and health cases are restricted automatically</small></span></div></section>
    {state.message?<div className={`form-status ${state.tone==="error"?"error":"success"}`}>{state.tone==="error"?<AlertTriangle/>:<FolderHeart/>}{state.message}</div>:null}
    <section className="metrics care-metrics"><article className="metric"><span>Active cases</span><strong>{metrics.open}</strong><small>Open through in progress</small></article><article className="metric red"><span>Urgent / critical</span><strong>{metrics.urgent}</strong><small>Leadership attention</small></article><article className="metric amber"><span>Review overdue</span><strong>{metrics.overdue}</strong><small>Action date passed</small></article><article className="metric violet"><span>Restricted</span><strong>{metrics.restricted}</strong><small>Need-to-know records</small></article></section>
    <div className="care-grid">
      <form className="panel settings-form" onSubmit={openCase}>
        <div className="panel-title"><div><span>OPEN CASE</span><h3>Record facts and assign ownership</h3></div><FolderHeart/></div>
        <div className="form-grid"><label>Learner<select name="studentId" required><option value="">Choose learner</option>{workspace.learners.map(item=><option key={item.id} value={item.id}>{item.name} · {item.matricule}</option>)}</select></label><label>Category<select name="category" defaultValue="learning_support"><option value="learning_support">Learning support</option><option value="attendance">Attendance</option><option value="wellbeing">Wellbeing</option><option value="safeguarding">Safeguarding</option><option value="discipline">Discipline</option><option value="health">Health</option><option value="financial_support">Financial support</option><option value="other">Other</option></select></label><label>Priority<select name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option><option value="critical">Critical</option></select></label><label>Review due<input type="date" name="reviewDueOn"/></label><label>Assign to<select name="assignedTo"><option value="">Triage queue</option>{staff.map(item=><option key={item.profileId} value={item.profileId}>{item.name} · {item.role.replaceAll("_"," ")}</option>)}</select></label><label>Case title<input name="title" required minLength={3}/></label></div>
        <label>Factual summary<textarea name="summary" required minLength={10} rows={5} placeholder="Record observed facts, dates, source and immediate safety action. Avoid unsupported conclusions."/></label>
        <button className="primary" type="submit"><ShieldAlert/>Open protected case</button>
      </form>
      <form className="panel settings-form" onSubmit={progressCase}>
        <div className="panel-title"><div><span>PROGRESS CASE</span><h3>Assign, act, resolve and close</h3></div><CalendarClock/></div>
        <label>Case<select name="caseId" required value={selectedCase} onChange={event=>setSelectedCase(event.target.value)}><option value="">Choose case</option>{workspace.cases.map(item=><option key={item.id} value={item.id}>{item.caseNumber} · {item.studentName} · {item.title}</option>)}</select></label>
        <div className="form-grid"><label>Next state<select name="targetStatus" defaultValue="in_progress"><option value="triaged">Triaged</option><option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="open">Reopen</option></select></label><label>Review due<input type="date" name="reviewDueOn"/></label><label>Assign to<select name="assignedTo"><option value="">Keep current owner</option>{staff.map(item=><option key={item.profileId} value={item.profileId}>{item.name} · {item.role.replaceAll("_"," ")}</option>)}</select></label></div>
        <label>Evidence / action / outcome<textarea name="note" required minLength={2} rows={5} placeholder="What was verified, what action was taken, who was informed, and what happens next?"/></label>
        <button className="primary" type="submit"><CalendarClock/>Record case action</button>
      </form>
    </div>
    <section className="panel case-register"><div className="panel-title"><div><span>CONTROLLED REGISTER</span><h3>Cases visible to your role</h3></div><LockKeyhole/></div>{workspace.cases.length===0?<p>No case is visible to this role.</p>:workspace.cases.map(item=><article key={item.id} className={`case-row priority-${item.priority}`}><header><span><strong>{item.caseNumber}</strong><small>{item.studentName} · {item.category.replaceAll("_"," ")}</small></span><em>{item.status.replaceAll("_"," ")}</em></header><h4>{item.title}</h4><p>{item.summary}</p><footer><span>{item.priority} priority</span>{item.confidentiality==="restricted"?<span><LockKeyhole/>Restricted</span>:null}<span>Owner: {item.assignedTo??"Triage queue"}</span><span>Review: {item.reviewDueOn??"Not scheduled"}</span></footer></article>)}</section>
  </div>;
}
