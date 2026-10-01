import { AlertTriangle, ArrowRight, BookOpenCheck, CircleDollarSign, ClipboardCheck, FolderHeart, ShieldCheck, UserPlus } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import { buildInstitutionFlowHealth, evaluateRecommendedPolicies, type PolicyAction } from "../domain/operationalExcellence";
import { canOpenView } from "../lib/access";
import type { ViewKey } from "./Shell";

type ActionItem={
  id:string;
  title:string;
  detail:string;
  owner:string;
  count:number;
  tone:"critical"|"warning"|"info";
  view:ViewKey;
  group:"decision"|"review"|"handoff";
};

const viewForArea:Record<PolicyAction["area"],ViewKey>={
  learner:"learners",learning:"learning",finance:"finance",transport:"transport",
  admissions:"admissions",care:"care",communication:"signals",
};

function iconFor(view:ViewKey){
  if(view==="finance")return <CircleDollarSign/>;
  if(view==="admissions")return <UserPlus/>;
  if(view==="academics"||view==="learning")return <BookOpenCheck/>;
  if(view==="care")return <FolderHeart/>;
  return <ClipboardCheck/>;
}

export default function ActionCentre({workspace,onNavigate}:{workspace:WorkspaceData;onNavigate:(view:ViewKey)=>void}){
  const evidence={
    learners:workspace.learners,academics:workspace.academics,finance:workspace.finance,
    transport:workspace.transport,admissions:workspace.admissions,signals:workspace.signals,cases:workspace.cases,
  };
  const policy=evaluateRecommendedPolicies(evidence).map<ActionItem>(action=>({
    id:action.id,title:action.title,detail:action.reason,owner:action.owner,count:action.evidenceCount,
    tone:action.severity,view:viewForArea[action.area],group:"decision",
  }));
  const lessonReview=workspace.academics.lessonPlans.filter(x=>x.status==="submitted").length;
  const assessmentReview=workspace.academics.assessments.filter(x=>x.status==="submitted").length;
  const admissionReview=workspace.admissions.filter(x=>!["rejected","withdrawn","enrolled"].includes(x.status)).length;
  const reviews:ActionItem[]=[
    lessonReview?{
      id:"lesson-review",title:"Lesson plans awaiting review",
      detail:"Submitted lesson plans are ready for review.",
      owner:"Academic reviewer",count:lessonReview,tone:"warning",view:"academics",group:"review"}:null,
    assessmentReview?{
      id:"assessment-review",title:"Assessments awaiting moderation",
      detail:"Submitted marks are ready for moderation.",
      owner:"Independent reviewer",count:assessmentReview,tone:"warning",view:"academics",group:"review"}:null,
    admissionReview?{
      id:"admission-review",title:"Admissions still in progress",
      detail:"Applications are waiting for the next admissions step.",
      owner:"Admissions",count:admissionReview,tone:"info",view:"admissions",group:"review"}:null,
  ].filter((entry):entry is ActionItem=>Boolean(entry));

  const handoffs=buildInstitutionFlowHealth(evidence)
    .filter(entry=>entry.status!=="healthy")
    .map<ActionItem>(entry=>({
      id:entry.id,title:entry.title,detail:entry.detail,owner:entry.owner,count:entry.evidenceCount,
      tone:entry.status==="broken"?"critical":"warning",
      view:entry.id.startsWith("admission")||entry.id.startsWith("enrolment")?"admissions":
        entry.id.startsWith("transport")?"transport":
        entry.id.startsWith("learning")||entry.id.startsWith("report")?"academics":"command",
      group:"handoff",
    }));

  const allowed=(entry:ActionItem)=>canOpenView(workspace.viewer,entry.view);
  const items=[...handoffs,...reviews,...policy].filter(allowed);
  const critical=items.filter(entry=>entry.tone==="critical").length;
  const groups:[ActionItem["group"],string,string][]=[
    ["handoff","Process gaps","School work that did not reach its next step"],
    ["review","Reviews","Work waiting for the right person to review it"],
    ["decision","Follow-up","Items that need a person to act"],
  ];

  return <section className="action-centre">
    <header className="action-centre-head">
      <div><span>YOUR ACTION CENTRE</span><h3>{items.length?(items.length+" action"+(items.length===1?"":"s")+" need ownership"):"Nothing is waiting for you"}</h3><p>One place for the school work that needs attention. Open an item to deal with it.</p></div>
      <div className={"action-centre-count "+(critical?"danger":"")}><strong>{critical||items.length}</strong><small>{critical?"critical":"open"}</small></div>
    </header>
    {items.length?groups.map(([group,title,caption])=>{
      const groupItems=items.filter(entry=>entry.group===group);if(!groupItems.length)return null;
      return <div className="action-group" key={group}>
        <div className="action-group-title"><span>{title}</span><small>{caption}</small></div>
        {groupItems.slice(0,8).map(entry=><article className={"action-centre-row "+entry.tone} key={entry.id}>
          <div className="action-centre-icon">{entry.tone==="critical"?<AlertTriangle/>:entry.group==="handoff"?<ShieldCheck/>:iconFor(entry.view)}</div>
          <div><strong>{entry.title}</strong><p>{entry.detail}</p><small>{entry.owner+" · "+entry.count+" related record"+(entry.count===1?"":"s")}</small></div>
          <button type="button" onClick={()=>onNavigate(entry.view)}>Open <ArrowRight/></button>
        </article>)}
      </div>;
    }):<div className="action-centre-clear"><ShieldCheck/><div><strong>You are all caught up</strong><p>New work will appear here when something needs review, follow-up or a decision.</p></div></div>}
  </section>;
}
