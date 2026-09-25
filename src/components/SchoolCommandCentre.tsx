import { AlertTriangle, BookOpenCheck, BusFront, CircleDollarSign, ClipboardCheck, FolderHeart, MessageSquareMore, ShieldCheck, UserPlus } from "lucide-react";
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
 const priority=financeExceptions+urgentCare+urgentSignals+delayedTrips;
 const all:QueueItem[]=[
  {id:"admissions",view:"admissions",title:"Admissions waiting",detail:"Applications that need review, decision or enrolment.",count:admissionPending,tone:admissionPending?"attention":"normal",owner:"Admissions",icon:<UserPlus/>},
  {id:"academic",view:"academics",title:"Teaching reviews",detail:(lessonReview+assessmentReview)+" academic item(s) awaiting review.",count:lessonReview+assessmentReview,tone:lessonReview+assessmentReview?"attention":"normal",owner:"Academics",icon:<BookOpenCheck/>},
  {id:"care",view:"care",title:"Learner concerns",detail:urgentCare?urgentCare+" urgent case(s) need authorised attention.":"Protected learner support items.",count:careOpen,tone:urgentCare?"urgent":careOpen?"attention":"normal",owner:"Safeguarding",icon:<FolderHeart/>},
  {id:"finance",view:"finance",title:"Money needing control",detail:cashAwaiting?cashAwaiting.toLocaleString("fr-FR")+" FCFA is awaiting deposit or settlement.":"Collections and settlement are under control.",count:financeExceptions,tone:financeExceptions?"urgent":cashAwaiting?"attention":"normal",owner:"Finance",icon:<CircleDollarSign/>},
  {id:"transport",view:"transport",title:"Transport today",detail:delayedTrips?delayedTrips+" delayed journey(s) need attention.":openTrips+" journey(s) currently open.",count:openTrips,tone:delayedTrips?"urgent":openTrips?"attention":"normal",owner:"Transport",icon:<BusFront/>},
  {id:"signals",view:"signals",title:"Messages to follow up",detail:urgentSignals?urgentSignals+" urgent message(s) need routing.":"Unresolved messages and feedback.",count:openSignals,tone:urgentSignals?"urgent":openSignals?"attention":"normal",owner:"School Office",icon:<MessageSquareMore/>}
 ];
 const candidates=all.filter(item=>can(item.view));
 const active=candidates.filter(item=>item.count>0||item.id==="finance"&&cashAwaiting>0);
 if(!canOpenView(viewer,"command"))return null;
 return <div className="content role-workspace command-today">
  <section className="role-hero"><div><span className="eyebrow">{ownerView?(viewer.positionTitle||"Leadership")+" · TODAY":"MY SCHOOL WORK · TODAY"}</span><h2>{ownerView?(priority?priority+" item"+(priority===1?"":"s")+" need your attention":"School is operating normally"):"What needs your attention now?"}</h2><p>{ownerView?"A live view of the school. Open only what needs a decision or closer look.":"DREEM shows only the work enabled by your current authority."}</p></div><div className="role-hero-status"><span className={"status-pill "+(priority?"attention":"") }><ShieldCheck size={14}/>{priority?priority+" priority":"Operating normally"}</span></div></section>
  <section className="visual-stats">
   <article className="visual-stat amber"><div className="icon"><CircleDollarSign/></div><div><span>CASH AWAITING CONFIRMATION</span><strong>{cashAwaiting.toLocaleString("fr-FR")}</strong><small>FCFA</small></div></article>
   <article className="visual-stat"><div className="icon"><ClipboardCheck/></div><div><span>ADMISSIONS</span><strong>{admissionPending}</strong><small>in progress</small></div></article>
   <article className={"visual-stat "+(priority?"red":"green")}><div className="icon"><AlertTriangle/></div><div><span>PRIORITY ITEMS</span><strong>{priority}</strong><small>{priority?"need review":"nothing urgent"}</small></div></article>
   <article className="visual-stat green"><div className="icon"><BusFront/></div><div><span>TRANSPORT</span><strong>{openTrips}</strong><small>{delayedTrips?delayedTrips+" delayed":"operating now"}</small></div></article>
  </section>
  <div className="focus-grid">
   <section className="focus-card"><div className="panel-title"><ShieldCheck/><div><span>NEEDS YOUR DECISION</span><h3>{active.length?active.length+" active area"+(active.length===1?"":"s"):"No urgent decision waiting"}</h3></div></div><div className="action-list">{active.length?active.map(item=><div className="action-row" key={item.id}><div className="action-icon">{item.icon}</div><div><strong>{item.title}</strong><small>{item.detail}</small></div><button onClick={()=>onNavigate(item.view)}>Review</button></div>):<p>The school is operating without a priority exception right now.</p>}</div></section>
   <aside className="focus-card"><div className="panel-title"><MessageSquareMore/><div><span>SCHOOL PULSE</span><h3>What changed today</h3></div></div><div className="action-list">{candidates.slice(0,4).map(item=><div className="action-row" key={item.id}><div className="action-icon">{item.icon}</div><div><strong>{item.owner}</strong><small>{item.count?item.count+" current item(s)":"No open issue"}</small></div><button onClick={()=>onNavigate(item.view)}>Open</button></div>)}</div></aside>
  </div>
  <details className="depth-drawer"><summary>See all school operating areas</summary><section className="panel"><div className="action-list">{candidates.map(item=><div className="action-row" key={item.id}><div className="action-icon">{item.icon}</div><div><strong>{item.title}</strong><small>{item.detail}</small></div><button onClick={()=>onNavigate(item.view)}>Open</button></div>)}</div></section></details>
 </div>;
}