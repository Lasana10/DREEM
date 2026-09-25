import { AlertTriangle, BookOpenCheck, BusFront, CircleDollarSign, FolderHeart, MessageSquareMore, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import { canAuthority, canOpenView } from "../lib/access";
import type { ViewKey } from "./Shell";
type QueueItem={id:string;view:ViewKey;title:string;detail:string;count:number;tone:"urgent"|"attention"|"normal";owner:string;icon:React.ReactNode};
export default function SchoolCommandCentre({workspace,onNavigate}:{workspace:WorkspaceData;onNavigate:(view:ViewKey)=>void}){
 const viewer=workspace.viewer,ownerView=canAuthority(viewer,"institutional_leadership");
 const admissionPending=workspace.admissions.filter(item=>!["admitted","rejected","withdrawn","enrolled"].includes(item.status)).length;
 const lessonReview=workspace.academics.lessonPlans.filter(item=>item.status==="submitted").length,assessmentReview=workspace.academics.assessments.filter(item=>item.status==="submitted").length;
 const careOpen=workspace.cases.filter(item=>!["resolved","closed"].includes(item.status)).length,urgentCare=workspace.cases.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","critical"].includes(item.priority)).length;
 const openSignals=workspace.signals.filter(item=>!["resolved","closed"].includes(item.status)).length,urgentSignals=workspace.signals.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","safeguarding"].includes(item.severity)).length;
 const openTrips=workspace.transport.trips.filter(item=>!["completed","cancelled"].includes(item.status)).length,delayedTrips=workspace.transport.trips.filter(item=>item.status==="delayed").length;
 const financeExceptions=workspace.finance.openExceptions,cashAwaiting=workspace.finance.cashAwaitingDeposit;
 const can=(view:ViewKey)=>canOpenView(viewer,view);
 const all:QueueItem[]=[
  {id:"admissions",view:"admissions",title:"Admissions waiting",detail:"Applications that need review or a decision.",count:admissionPending,tone:admissionPending?"attention":"normal",owner:"Admissions",icon:<UserPlus/>},
  {id:"academic",view:"academics",title:"Academic review",detail:lessonReview+" lesson plan(s) · "+assessmentReview+" assessment(s)",count:lessonReview+assessmentReview,tone:lessonReview+assessmentReview?"attention":"normal",owner:"Academics",icon:<BookOpenCheck/>},
  {id:"care",view:"care",title:"Learner concerns",detail:urgentCare?urgentCare+" urgent case(s)":"Protected support cases",count:careOpen,tone:urgentCare?"urgent":careOpen?"attention":"normal",owner:"Safeguarding",icon:<FolderHeart/>},
  {id:"finance",view:"finance",title:"Money needing control",detail:cashAwaiting?cashAwaiting.toLocaleString("fr-FR")+" FCFA awaiting deposit/settlement":"Finance trail under control",count:financeExceptions,tone:financeExceptions?"urgent":cashAwaiting?"attention":"normal",owner:"Finance",icon:<CircleDollarSign/>},
  {id:"transport",view:"transport",title:"Transport today",detail:delayedTrips?delayedTrips+" delayed journey(s)":"Live school journeys",count:openTrips,tone:delayedTrips?"urgent":openTrips?"attention":"normal",owner:"Transport",icon:<BusFront/>},
  {id:"signals",view:"signals",title:"Messages needing follow-up",detail:urgentSignals?urgentSignals+" urgent message(s)":"Unresolved school messages",count:openSignals,tone:urgentSignals?"urgent":openSignals?"attention":"normal",owner:"School Office",icon:<MessageSquareMore/>}
 ];
 const candidates=all.filter(item=>can(item.view)),priority=financeExceptions+urgentCare+urgentSignals+delayedTrips;
 if(!canOpenView(viewer,"command"))return null;
 const active=candidates.filter(item=>item.count>0||(item.id==="finance"&&cashAwaiting>0));
 return <div className="content role-workspace command-today">
  <section className="role-hero"><div><span className="eyebrow">{ownerView?(viewer.positionTitle||"LEADERSHIP").toUpperCase():"MY SCHOOL WORK"} · TODAY</span><h2>{priority?priority+" item"+(priority===1?"":"s")+" need attention":"School is operating normally"}</h2><p>Only the areas that need a decision or follow-up are brought forward.</p></div><div className="role-hero-status"><span className={priority?"status-pill attention":"status-pill"}><ShieldCheck size={15}/>{priority?"Attention needed":"Healthy"}</span></div></section>

  <div className="visual-stats">
   <article className="visual-stat green"><div className="icon"><UsersRound/></div><div><span>ACTIVE LEARNERS</span><strong>{workspace.learners.length}</strong><small>Current school records</small></div></article>
   <article className="visual-stat"><div className="icon"><CircleDollarSign/></div><div><span>CASH AWAITING</span><strong>{cashAwaiting.toLocaleString("fr-FR")}</strong><small>FCFA deposit / settlement</small></div></article>
   <article className="visual-stat purple"><div className="icon"><UserPlus/></div><div><span>ADMISSIONS</span><strong>{admissionPending}</strong><small>In progress</small></div></article>
   <article className={priority?"visual-stat red":"visual-stat green"}><div className="icon"><AlertTriangle/></div><div><span>PRIORITY ITEMS</span><strong>{priority}</strong><small>Need leadership attention</small></div></article>
  </div>

  <div className="focus-grid">
    <section className="focus-card"><span className="eyebrow">NEEDS YOUR ATTENTION</span><h3>{priority?"Review exceptions and decisions":"No urgent exception"}</h3><div className="action-list">{active.map(item=><article className="action-row" key={item.id}><div className="action-icon">{item.icon}</div><div><strong>{item.title}</strong><small>{item.detail}</small></div><button onClick={()=>onNavigate(item.view)}>Review</button></article>)}{!active.length?<p>No active issue requires leadership action right now.</p>:null}</div></section>
    <aside className="focus-card"><span className="eyebrow">SCHOOL TODAY</span><h3>Live operating picture</h3><div className="action-list"><article className="action-row"><div className="action-icon"><BusFront/></div><div><strong>{openTrips} journey{openTrips===1?"":"s"} operating</strong><small>{delayedTrips?delayedTrips+" delayed":"No reported delay"}</small></div><button onClick={()=>onNavigate("transport")}>Open</button></article><article className="action-row"><div className="action-icon"><BookOpenCheck/></div><div><strong>{lessonReview+assessmentReview} academic review{lessonReview+assessmentReview===1?"":"s"}</strong><small>Awaiting authorised review</small></div><button onClick={()=>onNavigate("academics")}>Open</button></article></div></aside>
  </div>

  <details className="depth-drawer"><summary>All school areas</summary><section className="panel"><div className="command-queue-grid">{candidates.map(item=><article className={"command-queue "+item.tone} key={item.id}><div className="command-queue-icon">{item.icon}</div><div><span>{item.owner}</span><h3>{item.title}</h3><strong>{item.count}</strong><p>{item.detail}</p><button onClick={()=>onNavigate(item.view)}>Open</button></div></article>)}</div></section></details>
 </div>;
}
