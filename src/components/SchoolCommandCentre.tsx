import { AlertTriangle, BookOpenCheck, BusFront, CircleDollarSign, ClipboardCheck, FolderHeart, MessageSquareMore, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import { canAuthority, canOpenView } from "../lib/access";
import type { ViewKey } from "./Shell";
type QueueItem={id:string;view:ViewKey;title:string;detail:string;count:number;tone:"urgent"|"attention"|"normal";owner:string;icon:React.ReactNode};
export default function SchoolCommandCentre({workspace,onNavigate}:{workspace:WorkspaceData;onNavigate:(view:ViewKey)=>void}){
 const viewer=workspace.viewer,ownerView=canAuthority(viewer,"institutional_leadership");
 const admissionPending=workspace.admissions.filter(item=>!["enrolled","rejected","withdrawn"].includes(item.status)).length;
 const lessonReview=workspace.academics.lessonPlans.filter(item=>item.status==="submitted").length,assessmentReview=workspace.academics.assessments.filter(item=>item.status==="submitted").length;
 const careOpen=workspace.cases.filter(item=>!["resolved","closed"].includes(item.status)).length,urgentCare=workspace.cases.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","critical"].includes(item.priority)).length;
 const openSignals=workspace.signals.filter(item=>!["resolved","closed"].includes(item.status)).length,urgentSignals=workspace.signals.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","safeguarding"].includes(item.severity)).length;
 const openTrips=workspace.transport.trips.filter(item=>!["completed","cancelled"].includes(item.status)).length,delayedTrips=workspace.transport.trips.filter(item=>item.status==="delayed").length;
 const financeExceptions=workspace.finance.openExceptions,cashAwaiting=workspace.finance.cashAwaitingDeposit;
 const can=(view:ViewKey)=>canOpenView(viewer,view);
 const all:QueueItem[]=[
  {id:"admissions",view:"admissions",title:"Admissions waiting",detail:"Applications ready for review or enrolment.",count:admissionPending,tone:admissionPending?"attention":"normal",owner:"Admissions",icon:<UserPlus/>},
  {id:"academic",view:"academics",title:"Academic review",detail:lessonReview+" lesson plan(s) and "+assessmentReview+" assessment(s) waiting.",count:lessonReview+assessmentReview,tone:lessonReview+assessmentReview?"attention":"normal",owner:"Academics",icon:<BookOpenCheck/>},
  {id:"care",view:"care",title:"Learner support",detail:urgentCare?urgentCare+" urgent protected case(s).":"Protected concerns requiring authorised follow-up.",count:careOpen,tone:urgentCare?"urgent":careOpen?"attention":"normal",owner:"Care",icon:<FolderHeart/>},
  {id:"finance",view:"finance",title:"Money needing control",detail:cashAwaiting?cashAwaiting.toLocaleString("fr-FR")+" FCFA awaiting deposit or settlement.":"Collections and settlement under control.",count:financeExceptions,tone:financeExceptions?"urgent":cashAwaiting?"attention":"normal",owner:"Finance",icon:<CircleDollarSign/>},
  {id:"transport",view:"transport",title:"Transport today",detail:delayedTrips?delayedTrips+" delayed journey(s).":"Active school journeys.",count:openTrips,tone:delayedTrips?"urgent":openTrips?"attention":"normal",owner:"Transport",icon:<BusFront/>},
  {id:"signals",view:"signals",title:"Messages to follow up",detail:urgentSignals?urgentSignals+" urgent message(s).":"Open school messages and feedback.",count:openSignals,tone:urgentSignals?"urgent":openSignals?"attention":"normal",owner:"School office",icon:<MessageSquareMore/>}
 ];
 const candidates=all.filter(item=>can(item.view)),priority=financeExceptions+urgentCare+urgentSignals+delayedTrips;
 const active=candidates.filter(item=>item.count>0||(item.id==="finance"&&cashAwaiting>0));
 const attendance=Math.round(workspace.learners.reduce((sum,l)=>sum+(l.attendance||0),0)/Math.max(workspace.learners.length,1));
 if(!canOpenView(viewer,"command"))return null;
 return <div className="content role-workspace command-today">
  <section className="role-hero"><div><span className="eyebrow">{ownerView?(viewer.positionTitle||"LEADERSHIP")+" · SCHOOL TODAY":"MY WORK · TODAY"}</span><h2>{priority?priority+" item"+(priority===1?"":"s")+" need attention":"School is operating normally"}</h2><p>{ownerView?"A calm view of the school. Open only what needs a decision.":"DREEM shows the work enabled by your authority."}</p></div><div className="role-hero-status"><span className={"status-pill "+(priority?"attention":"")}><ShieldCheck size={15}/>{priority?priority+" priority":"No priority exception"}</span></div></section>
  <section className="visual-stats">
   <article className="visual-stat"><div className="icon"><UsersRound/></div><div><span>ACTIVE LEARNERS</span><strong>{workspace.learners.length}</strong><small>school records</small></div></article>
   <article className="visual-stat green"><div className="icon"><ClipboardCheck/></div><div><span>ATTENDANCE</span><strong>{attendance}%</strong><small>current learner average</small></div></article>
   <article className="visual-stat amber"><div className="icon"><CircleDollarSign/></div><div><span>CASH TO CONFIRM</span><strong>{cashAwaiting.toLocaleString("fr-FR")}</strong><small>FCFA</small></div></article>
   <article className="visual-stat purple"><div className="icon"><BusFront/></div><div><span>TRANSPORT</span><strong>{openTrips}</strong><small>journeys operating</small></div></article>
  </section>
  <div className="focus-grid"><section className="focus-card"><div className="panel-title"><div><span>NEEDS YOUR ATTENTION</span><h3>{active.length?active.length+" active area"+(active.length===1?"":"s"):"Nothing urgent right now"}</h3></div></div><div className="action-list">{active.length?active.map(item=><article className="action-row" key={item.id}><div className="action-icon">{item.icon}</div><div><strong>{item.title}</strong><small>{item.detail}</small></div><button className={item.tone==="urgent"?"primary":""} onClick={()=>onNavigate(item.view)}>Review</button></article>):<article className="action-row"><div className="action-icon"><ShieldCheck/></div><div><strong>School operating normally</strong><small>DREEM will surface exceptions here when action is needed.</small></div></article>}</div></section>
  <aside className="focus-card"><span className="eyebrow">SCHOOL PULSE</span><h3>What changed today</h3><div className="action-list">{candidates.slice(0,4).map(item=><article className="action-row" key={item.id}><div className="action-icon">{item.icon}</div><div><strong>{item.count} · {item.owner}</strong><small>{item.title}</small></div></article>)}</div></aside></div>
  {ownerView?<details className="depth-drawer"><summary>Leadership control details</summary><section className="panel"><p>Protected evidence, workflow ownership and audit history remain available inside each operational area. DREEM keeps them out of the home screen until you need them.</p></section></details>:null}
 </div>;
}