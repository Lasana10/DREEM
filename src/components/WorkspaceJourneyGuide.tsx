import { BookOpenCheck, BusFront, FolderHeart, ReceiptText, UserPlus } from "lucide-react";
import type { Role } from "../domain/types";
import type { ViewKey } from "./Shell";

type Step={label:string;owner:string};
const journeys:Partial<Record<ViewKey,{title:string;summary:string;steps:Step[]}>>={
  admissions:{title:"Applicant → enrolled learner",summary:"Each decision advances one application record; enrolment creates the institutional learner record instead of starting again.",steps:[
    {label:"Application",owner:"Admissions"},{label:"Review & documents",owner:"Admissions reviewer"},{label:"Offer",owner:"Authorized school staff"},{label:"Acceptance",owner:"Guardian + school"},{label:"Enrolment",owner:"Admissions"},{label:"Learner / fees / credential",owner:"DREEM reactions"}
  ]},
  academics:{title:"Curriculum → teaching → evidence → reports",summary:"Academic work should move from structure to delivery and then to reviewed learner evidence.",steps:[
    {label:"Curriculum outcomes",owner:"Academic leadership"},{label:"Teaching ownership",owner:"Academic leadership"},{label:"Timetable",owner:"Academic leadership"},{label:"Lesson plan & delivery",owner:"Teacher"},{label:"Assignment & assessment",owner:"Teacher"},{label:"Review / moderation",owner:"Academic reviewer"},{label:"Report",owner:"Authorized publisher"}
  ]},
  finance:{title:"Charge → payment → custody → settlement",summary:"Money is not complete when it is collected. DREEM keeps the hand-off visible until independent settlement is confirmed.",steps:[
    {label:"Fee plan / charge",owner:"Leadership / finance"},{label:"Collect & allocate",owner:"Bursar"},{label:"Receipt",owner:"System"},{label:"Till closure",owner:"Bursar"},{label:"Independent review",owner:"Accountant"},{label:"Deposit",owner:"Bursar"},{label:"Settlement confirmation",owner:"Accountant"}
  ]},
  transport:{title:"Configure → assign → dispatch → journey → handover",summary:"Transport setup and the live school run are one accountable chain, but each role only receives the part it needs.",steps:[
    {label:"Route & stops",owner:"Transport manager"},{label:"Vehicle & driver",owner:"Transport manager"},{label:"Guardian consent",owner:"School / guardian"},{label:"Learner assignment",owner:"Transport manager"},{label:"Dispatch & journey",owner:"Driver / manager"},{label:"Pickup / gate",owner:"Gate"},{label:"History",owner:"Authorized school staff"}
  ]},
  care:{title:"Concern → protected case → action → review → close",summary:"Safeguarding and support records progress through owned actions and evidence, not informal notes.",steps:[
    {label:"Record facts",owner:"Authorized reporter"},{label:"Open protected case",owner:"Authorized care role"},{label:"Assign owner",owner:"Leadership / care"},{label:"Action",owner:"Case owner"},{label:"Review",owner:"Authorized reviewer"},{label:"Resolve / close",owner:"Authorized care role"}
  ]}
};

function Icon({view}:{view:ViewKey}){if(view==="admissions")return <UserPlus/>;if(view==="academics")return <BookOpenCheck/>;if(view==="finance")return <ReceiptText/>;if(view==="transport")return <BusFront/>;return <FolderHeart/>;}

export default function WorkspaceJourneyGuide({view,role}:{view:ViewKey;role:Role}){
  const journey=journeys[view];
  if(!journey)return null;
  const frontline:Partial<Record<Role,{title:string;body:string;steps:string[]}>>={
    administrator:{title:"Your admissions handoff",body:"Capture a complete application, submit it, then follow returned items. Approval and enrolment decisions stay with authorized reviewers.",steps:["Capture application","Submit to review","Handle returned items"]},
    bursar:{title:"Your money work",body:"Collect, receipt, close your till and deposit approved cash. Independent review is somebody else’s responsibility.",steps:["Collect","Receipt","Close till","Deposit"]},
    accountant:{title:"Your review work",body:"Review cashier evidence, reconcile exceptions and confirm settlement. You do not collect the same money you approve.",steps:["Review closure","Resolve exceptions","Confirm settlement"]},
    driver:{title:"Today’s journey",body:"Operate the assigned trip. Route setup, fleet administration and guardian configuration stay out of your driver workspace.",steps:["Start trip","Stops & learners","Finish / report incident"]},
    security_guard:{title:"Your gate decision",body:"Verify the learner and authorized collector, then release or deny. Transport configuration stays outside the gate workspace.",steps:["Scan","Verify","Release / deny"]},
  };
  const simple=frontline[role];
  if(simple&&((role==="administrator"&&view==="admissions")||(["bursar","accountant"].includes(role)&&view==="finance")||(["driver","security_guard"].includes(role)&&view==="transport"))){
    return <section className="panel lifecycle-panel workspace-journey role-handoff" aria-label={simple.title}>
      <div className="panel-title"><Icon view={view}/><div><span>YOUR WORK</span><h3>{simple.title}</h3><p>{simple.body}</p></div></div>
      <div className="lifecycle-rail compact">{simple.steps.map((step,index)=><span key={step}><b>{index+1}</b>{step}</span>)}</div>
    </section>;
  }
  const roleHint=role==="teacher"&&view==="care"?"Teachers record observed facts and escalate; protected decisions remain with authorized safeguarding roles.":"This full map is for oversight. Stages owned by another role remain status only, not editable controls.";
  return <section className="panel lifecycle-panel workspace-journey" aria-label={`${journey.title} lifecycle`}>
    <div className="panel-title"><Icon view={view}/><div><span>WORKFLOW MAP</span><h3>{journey.title}</h3><p>{journey.summary}</p></div></div>
    <div className="lifecycle-rail">{journey.steps.map((step,index)=><span key={step.label}><b>{index+1}</b>{step.label}<small>{step.owner}</small></span>)}</div>
    <p className="lifecycle-note">{roleHint}</p>
  </section>;
}
