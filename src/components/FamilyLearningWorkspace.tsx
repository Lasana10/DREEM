import { BookOpenCheck, BusFront, GraduationCap, ReceiptText, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WorkspaceData } from "../lib/repository";
import { loadLearnerFeeStatement, type LearnerFeeStatementRow } from "../lib/familyFinance";
import { loadPickupCircle, type PickupCircleMember } from "../lib/pickupCircle";

function messageFrom(reason:unknown){return reason instanceof Error?reason.message:reason&&typeof reason==="object"&&"message" in reason&&typeof reason.message==="string"?reason.message:"The family record could not be loaded.";}
const money=(value:number)=>new Intl.NumberFormat("fr-FR").format(value)+" FCFA";
const dateText=(value:string|undefined)=>value?new Date(value).toLocaleDateString():"—";

export default function FamilyLearningWorkspace({workspace}:{workspace:WorkspaceData}){
 const [selectedStudentId,setSelectedStudentId]=useState(workspace.learners[0]?.id??"");
 const [familyRecords,setFamilyRecords]=useState<{key:string;statement:LearnerFeeStatementRow[];pickupCircle:PickupCircleMember[]}>({key:"",statement:[],pickupCircle:[]}),[familyError,setFamilyError]=useState("");
 const learner=workspace.learners.find(item=>item.id===selectedStudentId)??workspace.learners[0],learnerId=learner?.id??"",learnerClass=learner?.className??"";
 const familyKey=JSON.stringify([workspace.viewer.id,learnerId]);
 const familyLoading=Boolean(learnerId)&&familyRecords.key!==familyKey&&!familyError;
 const statement=familyRecords.key===familyKey?familyRecords.statement:[],pickupCircle=familyRecords.key===familyKey?familyRecords.pickupCircle:[];
 const assignments=useMemo(()=>workspace.academics.assignmentsForLearners.filter(item=>item.status==="published"&&(!learnerClass||item.className===learnerClass)),[workspace.academics.assignmentsForLearners,learnerClass]);
 const submissions=workspace.academics.assignmentSubmissions.filter(item=>item.studentId===learnerId),reportCards=workspace.academics.reportCards.filter(item=>item.studentId===learnerId&&item.status==="published");
 const transportAssignment=workspace.transport.assignments.find(item=>item.studentId===learnerId&&item.status==="active"),transportTrips=transportAssignment?workspace.transport.trips.filter(item=>item.routeId===transportAssignment.routeId&&item.status!=="cancelled").slice(0,3):[];
 const submittedAssignmentIds=new Set(submissions.filter(item=>item.status!=="needs_revision").map(item=>item.assignmentId)),due=assignments.filter(item=>!submittedAssignmentIds.has(item.id));
 const charges=statement.filter(item=>item.entryType==="charge"),payments=statement.filter(item=>item.entryType==="payment"),overdue=charges.filter(item=>item.status==="overdue");
 useEffect(()=>{let cancelled=false;if(!learnerId)return;Promise.all([loadLearnerFeeStatement(learnerId),loadPickupCircle(learnerId)]).then(([nextStatement,nextPickup])=>{if(cancelled)return;setFamilyRecords({key:familyKey,statement:nextStatement,pickupCircle:nextPickup});setFamilyError("");}).catch(reason=>{if(!cancelled){setFamilyRecords({key:familyKey,statement:[],pickupCircle:[]});setFamilyError(messageFrom(reason));}});return()=>{cancelled=true;};},[learnerId,familyKey]);
 if(!learner)return <div className="content"><section className="panel"><h2>No linked learner</h2><p>This family account does not currently have a learner record it is authorised to view.</p></section></div>;

 return <div className="content role-workspace family-workspace">
  <section className="role-hero"><div><span className="eyebrow">DREEM FAMILY · TODAY</span><h2>{learner.name}</h2><p>{learner.className} · {learner.matricule}</p></div><div className="role-hero-status"><span className="status-pill"><ShieldCheck size={15}/>Family view</span></div></section>

  {workspace.learners.length>1?<div className="family-child-strip">{workspace.learners.map(item=><button key={item.id} className={"family-child "+(item.id===learnerId?"active":"")} onClick={()=>{setSelectedStudentId(item.id);setFamilyError("");}}><strong>{item.name}</strong><small>{item.className}</small></button>)}</div>:null}
  {familyError?<div className="form-status error" role="alert">Some family records could not be refreshed: {familyError}</div>:null}

  <div className="visual-stats">
   <article className="visual-stat green"><div className="icon"><GraduationCap/></div><div><span>ATTENDANCE</span><strong>{Math.round(learner.attendance)}%</strong><small>Current attendance</small></div></article>
   <article className="visual-stat purple"><div className="icon"><BookOpenCheck/></div><div><span>DUE WORK</span><strong>{due.length}</strong><small>{submissions.length} submission(s) recorded</small></div></article>
   <article className={overdue.length?"visual-stat amber":"visual-stat green"}><div className="icon"><WalletCards/></div><div><span>FEE BALANCE</span><strong>{money(learner.feeBalance??0)}</strong><small>{overdue.length?overdue.length+" overdue installment(s)":"No overdue installment"}</small></div></article>
   <article className="visual-stat"><div className="icon"><BusFront/></div><div><span>TRANSPORT</span><strong>{transportAssignment?"Assigned":"—"}</strong><small>{transportAssignment?.routeName||"No active route"}</small></div></article>
  </div>

  <div className="focus-grid">
   <section className="focus-card"><span className="eyebrow">WHAT NEEDS ATTENTION</span><h3>{due.length+overdue.length?due.length+overdue.length+" item(s)":"Everything is up to date"}</h3><div className="action-list">
    {due.slice(0,4).map(item=><article className="action-row" key={item.id}><div className="action-icon"><BookOpenCheck/></div><div><strong>{item.title}</strong><small>{item.subjectName} · due {new Date(item.dueAt).toLocaleDateString()}</small></div><span className="status-pill attention">Due</span></article>)}
    {overdue.slice(0,3).map(item=><article className="action-row" key={item.entryId}><div className="action-icon"><WalletCards/></div><div><strong>{item.label}</strong><small>{money(Math.abs(item.amount))} · due {dateText(item.dueOn)}</small></div><span className="status-pill attention">Overdue</span></article>)}
    {!due.length&&!overdue.length?<p>No schoolwork or fee item needs immediate attention.</p>:null}
   </div></section>

   <aside className="focus-card"><span className="eyebrow">TODAY</span><h3>School life at a glance</h3><div className="action-list">
    <article className="action-row"><div className="action-icon"><BusFront/></div><div><strong>{transportAssignment?transportAssignment.routeName:"No school transport"}</strong><small>{transportTrips[0]?transportTrips[0].status.replaceAll("_"," "):"No current journey update"}</small></div></article>
    <article className="action-row"><div className="action-icon"><ReceiptText/></div><div><strong>{payments.length} verified payment{payments.length===1?"":"s"}</strong><small>{familyLoading?"Refreshing statement":"Receipt history available below"}</small></div></article>
   </div></aside>
  </div>

  <details className="depth-drawer"><summary>Fees and receipts</summary><section className="panel"><div className="panel-title"><WalletCards/><div><span>FEES & INSTALLMENTS</span><h3>Charges and payment history</h3></div></div>{charges.map(item=><article className="document-row" key={item.entryId}><strong>{item.label}</strong><span>{money(Math.abs(item.amount))} · due {dateText(item.dueOn)} · {item.status.replaceAll("_"," ")}</span></article>)}{payments.map(item=><article className="document-row" key={item.entryId}><strong>{item.receiptNumber||item.label}</strong><span>{money(Math.abs(item.amount))} · {dateText(item.occurredOn)}</span><small>{item.status.replaceAll("_"," ")}</small></article>)}{!charges.length&&!payments.length&&!familyLoading?<p>No released finance record is visible yet.</p>:null}</section></details>

  <details className="depth-drawer"><summary>Learning and results</summary><section className="panel"><div className="panel-title"><BookOpenCheck/><div><span>LEARNING</span><h3>Schoolwork and published results</h3></div></div>{assignments.map(item=><article className="document-row" key={item.id}><strong>{item.title}</strong><span>{item.subjectName} · due {new Date(item.dueAt).toLocaleString()}</span><small>{submittedAssignmentIds.has(item.id)?"Submitted":"Awaiting learner submission"}</small></article>)}{reportCards.map(item=><article className="document-row" key={item.id}><strong>{item.termName} report</strong><span>{typeof item.overallAverage==="number"?"Average "+item.overallAverage:"Average pending"}</span></article>)}</section></details>

  <details className="depth-drawer"><summary>Transport and safe pickup</summary><section className="panel"><div className="panel-title"><UsersRound/><div><span>PICKUP CIRCLE</span><h3>People currently recognised for pickup</h3></div></div>{transportAssignment?<article className="document-row"><strong>{transportAssignment.routeName}</strong><span>{transportAssignment.pickupStopName} → {transportAssignment.dropoffStopName}</span></article>:null}{pickupCircle.map(member=><article className="document-row" key={member.collectorId}><strong>{member.fullName} · {member.relationship}</strong><span>{member.status} · valid to {dateText(member.validUntil)}</span></article>)}{!pickupCircle.length&&!familyLoading?<p>No authorised pickup person is currently visible.</p>:null}</section></details>
 </div>;
}
