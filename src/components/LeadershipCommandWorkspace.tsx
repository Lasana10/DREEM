import { AlertTriangle, BookOpenCheck, BusFront, CircleDollarSign, ClipboardCheck, FolderHeart, MessageSquareMore, UserPlus } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import type { ViewKey } from "./Shell";

type WorkItem={id:string;title:string;detail:string;view:ViewKey;kind:"urgent"|"review"|"routine"};

export default function LeadershipCommandWorkspace({workspace,onNavigate}:{workspace:WorkspaceData;onNavigate:(view:ViewKey)=>void}){
  const admissions=workspace.admissions.filter(item=>!["enrolled","rejected","withdrawn"].includes(item.status));
  const submittedAssessments=workspace.academics.assessments.filter(item=>item.status==="submitted");
  const submittedPlans=workspace.academics.lessonPlans.filter(item=>item.status==="submitted");
  const openCases=workspace.cases.filter(item=>!["resolved","closed","cancelled"].includes(item.status));
  const urgentCases=openCases.filter(item=>["urgent","critical"].includes(item.priority));
  const openSignals=workspace.signals.filter(item=>!["resolved","closed"].includes(item.status));
  const openTrips=workspace.transport.trips.filter(item=>!["completed","cancelled"].includes(item.status));
  const financeExceptions=workspace.finance.openExceptions;
  const items:WorkItem[]=[
    ...urgentCases.map(item=>({id:`case-${item.id}`,title:`Safeguarding: ${item.title}`,detail:`${item.studentName} · ${item.priority} · ${item.status}`,view:"care" as ViewKey,kind:"urgent" as const})),
    ...(financeExceptions?[{id:"finance-exceptions",title:`${financeExceptions} finance exception${financeExceptions===1?"":"s"} need review`,detail:"Collector and reviewer evidence must be reconciled before settlement.",view:"finance" as ViewKey,kind:"urgent" as const}]:[]),
    ...submittedAssessments.slice(0,4).map(item=>({id:`assessment-${item.id}`,title:`Assessment awaiting review: ${item.title}`,detail:`${item.className} · ${item.subjectName||"Subject"}`,view:"academics" as ViewKey,kind:"review" as const})),
    ...submittedPlans.slice(0,4).map(item=>({id:`plan-${item.id}`,title:`Lesson plan awaiting review: ${item.title}`,detail:`${item.className} · ${item.subjectName}`,view:"academics" as ViewKey,kind:"review" as const})),
    ...admissions.slice(0,5).map(item=>({id:`admission-${item.id}`,title:`Admission: ${item.applicantName}`,detail:`${item.status.replaceAll("_"," ")} · ${item.requestedClassName||"Class not chosen"}`,view:"admissions" as ViewKey,kind:"routine" as const})),
    ...openSignals.slice(0,4).map(item=>({id:`signal-${item.id}`,title:`${item.category}: ${item.subjectName}`,detail:`${item.severity} · ${item.status.replaceAll("_"," ")}`,view:"signals" as ViewKey,kind:item.severity==="urgent"||item.severity==="safeguarding"?"urgent" as const:"routine" as const})),
  ];
  const next=items[0];
  return <div className="content role-workspace leadership-command">
    <section className="page-intro"><div><span>DREEM SCHOOL · TODAY</span><h2>Run what needs attention now.</h2><p>Command is a work queue, not a display wall. Each item opens the operational workspace that owns the next action.</p></div>{next?<div className="care-assurance"><AlertTriangle/><span><strong>Next priority</strong><small>{next.title}</small></span></div>:<div className="care-assurance"><ClipboardCheck/><span><strong>No urgent queue item</strong><small>Continue normal school operations.</small></span></div>}</section>
    <div className="metrics"><article className="metric"><span>Admissions active</span><strong>{admissions.length}</strong><small>Applications not yet closed</small></article><article className="metric amber"><span>Academic reviews</span><strong>{submittedAssessments.length+submittedPlans.length}</strong><small>Assessments + lesson plans</small></article><article className="metric red"><span>Protected cases</span><strong>{openCases.length}</strong><small>{urgentCases.length} urgent / critical</small></article><article className="metric blue"><span>Open journeys</span><strong>{openTrips.length}</strong><small>Transport in progress / dispatched</small></article></div>
    <div className="command-layout"><section className="panel"><div className="panel-title"><ClipboardCheck/><div><span>ACTION QUEUE</span><h3>{items.length} item{items.length===1?"":"s"} with a next owner</h3></div></div>{items.length?items.map(item=><article className={`command-work-item ${item.kind}`} key={item.id}><div><strong>{item.title}</strong><p>{item.detail}</p></div><button onClick={()=>onNavigate(item.view)}>Open work</button></article>):<p>No outstanding approval, exception or follow-up is visible to this role.</p>}</section><aside>
      <section className="panel command-shortcuts"><div className="panel-title"><UserPlus/><div><span>OPERATE</span><h3>Go directly to school work</h3></div></div><button onClick={()=>onNavigate("admissions")}><UserPlus/>Admissions</button><button onClick={()=>onNavigate("academics")}><BookOpenCheck/>Academic delivery</button><button onClick={()=>onNavigate("finance")}><CircleDollarSign/>Finance & fees</button><button onClick={()=>onNavigate("transport")}><BusFront/>Transport & pickup</button><button onClick={()=>onNavigate("care")}><FolderHeart/>Care & safeguarding</button><button onClick={()=>onNavigate("signals")}><MessageSquareMore/>Notices & feedback</button></section>
    </aside></div>
  </div>;
}
