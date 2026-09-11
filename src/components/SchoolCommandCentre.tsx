import { AlertTriangle, BookOpenCheck, BusFront, CircleDollarSign, ClipboardCheck, FolderHeart, MessageSquareMore, ShieldCheck, UserPlus } from "lucide-react";
import type { Role } from "../domain/types";
import type { WorkspaceData } from "../lib/repository";
import type { ViewKey } from "./Shell";

type QueueItem={id:string;view:ViewKey;title:string;detail:string;count:number;tone:"urgent"|"attention"|"normal";owner:string;icon:React.ReactNode};
const leadershipRoles:Role[]=["platform_founder","school_owner","principal","administrator","academic_head"];

export default function SchoolCommandCentre({workspace,onNavigate}:{workspace:WorkspaceData;onNavigate:(view:ViewKey)=>void}){
 const role=workspace.viewer.role;
 const admissionPending=workspace.admissions.filter(item=>!["admitted","rejected","withdrawn"].includes(item.status)).length;
 const lessonReview=workspace.academics.lessonPlans.filter(item=>item.status==="submitted").length;
 const assessmentReview=workspace.academics.assessments.filter(item=>item.status==="submitted").length;
 const careOpen=workspace.cases.filter(item=>!["resolved","closed"].includes(item.status)).length;
 const urgentCare=workspace.cases.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","critical"].includes(item.priority)).length;
 const openSignals=workspace.signals.filter(item=>!["resolved","closed"].includes(item.status)).length;
 const urgentSignals=workspace.signals.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","safeguarding"].includes(item.severity)).length;
 const openTrips=workspace.transport.trips.filter(item=>!["completed","cancelled"].includes(item.status)).length;
 const delayedTrips=workspace.transport.trips.filter(item=>item.status==="delayed").length;
 const financeExceptions=workspace.finance.openExceptions;
 const cashAwaiting=workspace.finance.cashAwaitingDeposit;
 const can=(view:ViewKey)=>{
   if(["platform_founder","school_owner","principal"].includes(role))return true;
   if(role==="administrator")return ["admissions","operations","learners","signals","studio"].includes(view);
   if(role==="academic_head")return ["academics","learning","learners","teachers","care","signals","studio"].includes(view);
   return false;
 };
 const candidates:QueueItem[]=[
  {id:"admissions",view:"admissions",title:"Admissions waiting",detail:"Applications still need review, decision, acceptance or enrolment.",count:admissionPending,tone:admissionPending?"attention":"normal",owner:"Admissions",icon:<UserPlus/>},
  {id:"academic",view:"academics",title:"Academic review queue",detail:`${lessonReview} lesson plan(s) + ${assessmentReview} assessment(s) submitted for review.`,count:lessonReview+assessmentReview,tone:lessonReview+assessmentReview?"attention":"normal",owner:"Academic leadership",icon:<BookOpenCheck/>},
  {id:"care",view:"care",title:"Learner support & safeguarding",detail:urgentCare?`${urgentCare} urgent/critical protected case(s) require attention.`:"Open protected cases requiring owned follow-up.",count:careOpen,tone:urgentCare?"urgent":careOpen?"attention":"normal",owner:"Care / safeguarding",icon:<FolderHeart/>},
  {id:"finance",view:"finance",title:"Finance control exceptions",detail:cashAwaiting?`${cashAwaiting.toLocaleString("fr-FR")} FCFA cash remains in custody / awaiting settlement.`:"Review exceptions and settlement evidence.",count:financeExceptions,tone:financeExceptions?"urgent":cashAwaiting?"attention":"normal",owner:"Finance",icon:<CircleDollarSign/>},
  {id:"transport",view:"transport",title:"Transport operating now",detail:delayedTrips?`${delayedTrips} delayed journey(s) need transport follow-up.`:"Open school journeys and dispatch state.",count:openTrips,tone:delayedTrips?"urgent":openTrips?"attention":"normal",owner:"Transport",icon:<BusFront/>},
  {id:"signals",view:"signals",title:"Messages & feedback",detail:urgentSignals?`${urgentSignals} urgent/safeguarding signal(s) require routing.`:"Community feedback still awaiting resolution.",count:openSignals,tone:urgentSignals?"urgent":openSignals?"attention":"normal",owner:"School follow-up",icon:<MessageSquareMore/>},
 ].filter(item=>can(item.view));
 const active=candidates.filter(item=>item.count>0||item.id==="finance"&&cashAwaiting>0);
 const clear=candidates.length-active.length;
 if(!leadershipRoles.includes(role))return null;
 return <div className="content role-workspace command-today">
  <section className="page-intro"><div><span>DREEM SCHOOL · TODAY</span><h2>What needs the school’s attention now?</h2><p>Each queue comes from current institutional records and opens the workspace that owns the next action. No metric here is a dead end.</p></div><div className="care-assurance"><ShieldCheck/><span><strong>{active.length} active queue{active.length===1?"":"s"}</strong><small>{clear} area{clear===1?"":"s"} currently clear</small></span></div></section>
  <div className="command-summary"><article><ClipboardCheck/><span><strong>{admissionPending}</strong><small>admissions in progress</small></span></article><article><BookOpenCheck/><span><strong>{lessonReview+assessmentReview}</strong><small>academic reviews</small></span></article><article><AlertTriangle/><span><strong>{financeExceptions+urgentCare+urgentSignals}</strong><small>priority exceptions</small></span></article><article><BusFront/><span><strong>{openTrips}</strong><small>open journeys</small></span></article></div>
  <section className="command-queue-grid">{candidates.map(item=><article className={`command-queue ${item.tone}`} key={item.id}><div className="command-queue-icon">{item.icon}</div><div><span>{item.owner}</span><h3>{item.title}</h3><strong>{item.count}</strong><p>{item.detail}</p><button className={item.count>0?"primary":""} onClick={()=>onNavigate(item.view)}>{item.count>0?"Open work queue":"Open workspace"}</button></div></article>)}</section>
 </div>;
}
