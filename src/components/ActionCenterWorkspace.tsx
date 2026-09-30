import { AlertTriangle, BookOpenCheck, BusFront, CircleDollarSign, ClipboardCheck, FolderHeart, MessageSquareMore, ShieldCheck, UserPlus } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import { canOpenView } from "../lib/access";
import type { ViewKey } from "./Shell";

type ActionItem={
  id:string;
  view:ViewKey;
  title:string;
  detail:string;
  owner:string;
  count:number;
  tone:"urgent"|"attention"|"normal";
  icon:React.ReactNode;
};

export default function ActionCenterWorkspace({workspace,onNavigate}:{workspace:WorkspaceData;onNavigate:(view:ViewKey)=>void}){
  const {viewer}=workspace;
  const admissions=workspace.admissions.filter(item=>!["admitted","rejected","withdrawn","enrolled"].includes(item.status)).length;
  const lessonReviews=workspace.academics.lessonPlans.filter(item=>item.status==="submitted").length;
  const assessmentReviews=workspace.academics.assessments.filter(item=>item.status==="submitted").length;
  const reportDrafts=workspace.academics.reportCards.filter(item=>item.status==="draft").length;
  const urgentCare=workspace.cases.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","critical"].includes(item.priority)).length;
  const financeExceptions=workspace.finance.openExceptions;
  const cashAwaiting=workspace.finance.cashAwaitingDeposit;
  const delayedTrips=workspace.transport.trips.filter(item=>item.status==="delayed").length;
  const openTrips=workspace.transport.trips.filter(item=>!["completed","cancelled"].includes(item.status)).length;
  const urgentSignals=workspace.signals.filter(item=>!["resolved","closed"].includes(item.status)&&["urgent","safeguarding"].includes(item.severity)).length;
  const openSignals=workspace.signals.filter(item=>!["resolved","closed"].includes(item.status)).length;

  const all:ActionItem[]=[
    {id:"admissions",view:"admissions",title:"Admissions decisions",detail:"Applications waiting for review, decision or enrolment.",owner:"Admissions",count:admissions,tone:admissions?"attention":"normal",icon:<UserPlus/>},
    {id:"lesson-review",view:"academics",title:"Lesson-plan review",detail:"Teacher plans waiting for academic review.",owner:"Academic review",count:lessonReviews,tone:lessonReviews?"attention":"normal",icon:<BookOpenCheck/>},
    {id:"assessment-review",view:"academics",title:"Assessment moderation",detail:"Submitted assessment evidence waiting for independent review.",owner:"Academic review",count:assessmentReviews,tone:assessmentReviews?"attention":"normal",icon:<ClipboardCheck/>},
    {id:"reports",view:"academics",title:"Report publication",detail:"Draft learner reports waiting for authorized publication.",owner:"Academic publishing",count:reportDrafts,tone:reportDrafts?"attention":"normal",icon:<BookOpenCheck/>},
    {id:"care",view:"care",title:"Protected learner concerns",detail:"Urgent or critical learner-support cases requiring authorized follow-up.",owner:"Safeguarding",count:urgentCare,tone:urgentCare?"urgent":"normal",icon:<FolderHeart/>},
    {id:"finance",view:"finance",title:"Finance exceptions",detail:cashAwaiting?cashAwaiting.toLocaleString("fr-FR")+" FCFA awaits institutional confirmation.":"Payment, reconciliation or settlement exceptions.",owner:"Finance",count:financeExceptions+(cashAwaiting>0?1:0),tone:financeExceptions?"urgent":cashAwaiting?"attention":"normal",icon:<CircleDollarSign/>},
    {id:"transport",view:"transport",title:"Transport exceptions",detail:delayedTrips?delayedTrips+" delayed journey(s) need attention.":openTrips+" journey(s) currently open.",owner:"Transport",count:delayedTrips,tone:delayedTrips?"urgent":"normal",icon:<BusFront/>},
    {id:"messages",view:"signals",title:"Messages needing follow-up",detail:urgentSignals?urgentSignals+" urgent message(s) need routing.":openSignals+" unresolved message(s).",owner:"School office",count:urgentSignals||openSignals,tone:urgentSignals?"urgent":openSignals?"attention":"normal",icon:<MessageSquareMore/>},
  ].filter(item=>canOpenView(viewer,item.view));

  const active=all.filter(item=>item.count>0);
  const urgent=active.filter(item=>item.tone==="urgent").length;
  const total=active.reduce((sum,item)=>sum+item.count,0);

  return <div className="content action-centre-workspace">
    <section className="role-hero action-centre-hero">
      <div><span className="eyebrow">MY ACTION CENTRE</span><h2>{total?total+" item"+(total===1?"":"s")+" need attention":"Nothing is waiting on you"}</h2><p>One place for approvals, exceptions and hand-offs that are actually yours. DREEM keeps routine information out of the way until action is required.</p></div>
      <div className="role-hero-status"><span className={"status-pill "+(urgent?"danger":active.length?"attention":"info")}><ShieldCheck size={14}/>{urgent?urgent+" urgent":active.length?active.length+" active areas":"All clear"}</span></div>
    </section>

    <section className="action-centre-summary">
      <article><small>WAITING ON YOU</small><strong>{total}</strong><span>work items</span></article>
      <article><small>URGENT AREAS</small><strong>{urgent}</strong><span>need priority</span></article>
      <article><small>CLEAR AREAS</small><strong>{Math.max(0,all.length-active.length)}</strong><span>no action</span></article>
    </section>

    <section className="action-centre-board">
      <div className="action-centre-heading"><div><span>PRIORITY QUEUE</span><h3>Do the next important thing</h3></div><small>Only work within your current authority is shown.</small></div>
      {active.length?<div className="action-centre-list">{active.sort((a,b)=>a.tone===b.tone?b.count-a.count:a.tone==="urgent"?-1:b.tone==="urgent"?1:0).map(item=><article className={"action-centre-item "+item.tone} key={item.id}>
        <div className="action-centre-icon">{item.icon}</div>
        <div><span>{item.owner}</span><h3>{item.title}</h3><p>{item.detail}</p></div>
        <strong>{item.count}</strong>
        <button onClick={()=>onNavigate(item.view)}>Open work</button>
      </article>)}</div>:<div className="action-centre-empty"><ShieldCheck/><h3>You are clear</h3><p>No approval, exception or urgent hand-off is waiting in your current role.</p></div>}
    </section>

    <details className="depth-drawer"><summary>See all areas I can act on</summary><div className="action-centre-list compact">{all.map(item=><article className={"action-centre-item "+item.tone} key={item.id}><div className="action-centre-icon">{item.icon}</div><div><span>{item.owner}</span><h3>{item.title}</h3><p>{item.detail}</p></div><strong>{item.count}</strong><button onClick={()=>onNavigate(item.view)}>Open</button></article>)}</div></details>
  </div>;
}
