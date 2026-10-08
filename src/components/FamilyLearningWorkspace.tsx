import { BookOpenCheck, BusFront, GraduationCap, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WorkspaceData } from "../lib/repository";
import { loadLearnerFeeStatement, type LearnerFeeStatementRow } from "../lib/familyFinance";
import { loadPickupCircle, type PickupCircleMember } from "../lib/pickupCircle";
import { userFacingError } from "../lib/userFacingError";
import PublishedReportCard from "./PublishedReportCard";
import { useLanguage } from "../lib/useLanguage";

type FamilyTab="Today"|"Learning"|"Fees"|"Transport";
const messageFrom=(reason:unknown)=>userFacingError(reason,"Some family information could not be refreshed. Check your connection and try again.");
const money=(value:number)=>new Intl.NumberFormat("fr-FR").format(value)+" FCFA";
const dateText=(value:string|undefined)=>value?new Date(value).toLocaleDateString():"—";

export default function FamilyLearningWorkspace({workspace}:{workspace:WorkspaceData}){
 const {text:t,language}=useLanguage();
 const [selectedStudentId,setSelectedStudentId]=useState(workspace.learners[0]?.id??""),[tab,setTab]=useState<FamilyTab>("Today"),[refreshVersion,setRefreshVersion]=useState(0);
 const [familyRecords,setFamilyRecords]=useState<{key:string;statement:LearnerFeeStatementRow[];pickupCircle:PickupCircleMember[]}>({key:"",statement:[],pickupCircle:[]}),[familyError,setFamilyError]=useState("");
 const learner=workspace.learners.find(item=>item.id===selectedStudentId)??workspace.learners[0],learnerId=learner?.id??"",learnerClass=learner?.className??"";
 const familyKey=JSON.stringify([workspace.viewer.id,learnerId]);
 const familyLoading=Boolean(learnerId)&&familyRecords.key!==familyKey&&!familyError;
 const statement=familyRecords.key===familyKey?familyRecords.statement:[],pickupCircle=familyRecords.key===familyKey?familyRecords.pickupCircle:[];
 const assignments=useMemo(()=>workspace.academics.assignmentsForLearners.filter(item=>item.status==="published"&&(!learnerClass||item.className===learnerClass)),[workspace.academics.assignmentsForLearners,learnerClass]);
 const submissions=workspace.academics.assignmentSubmissions.filter(item=>item.studentId===learnerId),reportCards=workspace.academics.reportCards.filter(item=>item.studentId===learnerId&&item.status==="published");
 const transportAssignment=workspace.transport.assignments.find(item=>item.studentId===learnerId&&item.status==="active"),transportTrips=transportAssignment?workspace.transport.trips.filter(item=>item.routeId===transportAssignment.routeId&&item.status!=="cancelled").slice(0,5):[];
 const submittedAssignmentIds=new Set(submissions.filter(item=>item.status!=="needs_revision").map(item=>item.assignmentId)),due=assignments.filter(item=>!submittedAssignmentIds.has(item.id));
 const charges=statement.filter(item=>item.entryType==="charge"),payments=statement.filter(item=>item.entryType==="payment"),overdue=charges.filter(item=>item.status==="overdue");
 useEffect(()=>{let cancelled=false;if(!learnerId)return;Promise.all([loadLearnerFeeStatement(learnerId),loadPickupCircle(learnerId)]).then(([nextStatement,nextPickup])=>{if(cancelled)return;setFamilyRecords({key:familyKey,statement:nextStatement,pickupCircle:nextPickup});setFamilyError("");}).catch(reason=>{if(!cancelled){setFamilyRecords({key:familyKey,statement:[],pickupCircle:[]});setFamilyError(messageFrom(reason));}});return()=>{cancelled=true;};},[learnerId,familyKey,refreshVersion]);
 if(!learner)return <div className="content"><section className="panel"><h2>{t("No linked learner","Aucun élève associé")}</h2><p>{t("No child record is currently linked to this family account.","Aucun dossier d’élève n’est actuellement associé à ce compte familial.")}</p></section></div>;

 return <div className="content role-workspace family-workspace">
  <section className="role-hero"><div><span className="eyebrow">{t("DREEM FAMILY","DREEM FAMILLE")}</span><h2>{t("Your children, one calm view","Vos enfants, une vue d’ensemble claire")}</h2><p>{t("See what matters today for your child in one place.","Retrouvez les informations essentielles de votre enfant au même endroit.")}</p></div><div className="role-hero-status"><span className="status-pill"><ShieldCheck size={15}/>{t("Family view","Espace famille")}</span></div></section>

  {workspace.learners.length>1?<div className="family-child-strip">{workspace.learners.map(item=><button key={item.id} className={"family-child "+(item.id===learnerId?"active":"")} onClick={()=>{setSelectedStudentId(item.id);setFamilyError("");}}><strong>{item.name}</strong><small>{item.className}</small></button>)}</div>:null}

  <nav className="workspace-tabs" aria-label="Family workspace">
   {(["Today","Learning","Fees","Transport"] as FamilyTab[]).map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{({Today:t("Today","Aujourd’hui"),Learning:t("Learning","Apprentissage"),Fees:t("Fees","Scolarité"),Transport:t("Transport","Transport")} as Record<FamilyTab,string>)[item]}</button>)}
  </nav>

  {familyError?<div className="form-status error" role="alert"><span>{familyError} The school record has not been changed.</span><button type="button" className="secondary" onClick={()=>{setFamilyError("");setRefreshVersion(value=>value+1)}}>{t("Retry family information","Réessayer le chargement")}</button></div>:null}

  {tab==="Today"?<>
   <section className="role-hero"><div><span className="eyebrow">{learner.className}</span><h2>{learner.name}</h2><p>{learner.matricule}</p></div></section>
   <div className="visual-stats">
    <article className="visual-stat green"><div className="icon"><GraduationCap/></div><div><span>{t("ATTENDANCE","PRÉSENCE")}</span><strong>{Math.round(learner.attendance)}%</strong><small>{t("Current attendance","Taux de présence actuel")}</small></div></article>
    <article className="visual-stat purple"><div className="icon"><BookOpenCheck/></div><div><span>{t("DUE WORK","TRAVAUX À RENDRE")}</span><strong>{due.length}</strong><small>{submissions.length} {t("work submitted","travaux remis")}</small></div></article>
    <article className={overdue.length?"visual-stat amber":"visual-stat green"}><div className="icon"><WalletCards/></div><div><span>{t("FEE BALANCE","SOLDE DES FRAIS")}</span><strong>{money(learner.feeBalance??0)}</strong><small>{overdue.length?overdue.length+" overdue payment":"Nothing overdue"}</small></div></article>
    <article className="visual-stat"><div className="icon"><BusFront/></div><div><span>{t("TRANSPORT","TRANSPORT")}</span><strong>{transportAssignment?"Assigned":"—"}</strong><small>{transportAssignment?.routeName||t("No active route","Aucun itinéraire actif")}</small></div></article>
   </div>
   <div className="focus-grid">
    <section className="focus-card"><span className="eyebrow">{t("NEEDS ATTENTION","À SUIVRE")}</span><h3>{due.length+overdue.length?due.length+overdue.length+" item(s)":"Everything is up to date"}</h3><div className="action-list">{due.slice(0,3).map(item=><article className="action-row" key={item.id}><div className="action-icon"><BookOpenCheck/></div><div><strong>{item.title}</strong><small>{item.subjectName} · due {new Date(item.dueAt).toLocaleDateString(language==="fr"?"fr-CM":"en-CM")}</small></div><button onClick={()=>setTab("Learning")}>{t("Open","Ouvrir")}</button></article>)}{overdue.slice(0,2).map(item=><article className="action-row" key={item.entryId}><div className="action-icon"><WalletCards/></div><div><strong>{item.label}</strong><small>{money(Math.abs(item.amount))} · due {dateText(item.dueOn)}</small></div><button onClick={()=>setTab("Fees")}>{t("View","Consulter")}</button></article>)}{!due.length&&!overdue.length?<p>{t("No item needs immediate action.","Aucune action immédiate n’est requise.")}</p>:null}</div></section>
    <aside className="focus-card"><span className="eyebrow">TRANSPORT</span><h3>{transportAssignment?transportAssignment.routeName:"No active route"}</h3><p>{transportTrips[0]?transportTrips[0].status.replaceAll("_"," "):"No current journey update"}</p>{transportAssignment?<button onClick={()=>setTab("Transport")}>{t("View transport","Consulter le transport")}</button>:null}</aside>
   </div>
  </>:null}

  {tab==="Learning"?<section className="panel"><div className="panel-title"><BookOpenCheck/><div><span>{t("LEARNING","APPRENTISSAGE")}</span><h3>{t("School work and progress","Travaux scolaires et progrès")}</h3></div></div>{assignments.map(item=><article className="document-row" key={item.id}><strong>{item.title}</strong><span>{item.subjectName} · due {new Date(item.dueAt).toLocaleString(language==="fr"?"fr-CM":"en-CM")}</span><small>{submittedAssignmentIds.has(item.id)?"Submitted":"Not submitted yet"}</small></article>)}{reportCards.map(item=><PublishedReportCard key={item.id} report={item} learner={learner} brand={workspace.brand}/>)}{!assignments.length&&!reportCards.length?<p>{t("No released learning item is visible yet.","Aucun travail ou bulletin publié n’est encore disponible.")}</p>:null}</section>:null}

  {tab==="Fees"?<section className="panel"><div className="panel-title"><WalletCards/><div><span>FEES</span><h3>{t("Installments, payments and receipts","Échéances, paiements et reçus")}</h3></div></div><p className="panel-copy">Charges, recorded payments and reconciliation evidence appear separately. A receipt records a payment; bank or cash settlement may require an independent confirmation.</p>{familyLoading?<p>{t("Refreshing fee information…","Actualisation des informations financières…")}</p>:null}{charges.map(item=><article className="document-row" key={item.entryId}><strong>{item.label}</strong><span>{money(Math.abs(item.amount))} · due {dateText(item.dueOn)} · {item.status.replaceAll("_"," ")}</span></article>)}{payments.map(item=><article className="document-row" key={item.entryId}><strong>{item.receiptNumber||item.label}</strong><span>{money(Math.abs(item.amount))} · {dateText(item.occurredOn)}</span><small>{item.status.replaceAll("_"," ")}</small></article>)}{!charges.length&&!payments.length&&!familyLoading&&!familyError?<p>{t("No fee or payment record is available yet.","Aucun frais ni paiement n’est disponible pour le moment.")}</p>:null}</section>:null}

  {tab==="Transport"?<section className="focus-grid"><section className="panel"><div className="panel-title"><BusFront/><div><span>{t("TRANSPORT","TRANSPORT")}</span><h3>{t("Route and recent journeys","Itinéraire et trajets récents")}</h3></div></div>{transportAssignment?<><article className="document-row"><strong>{transportAssignment.routeName}</strong><span>{transportAssignment.pickupStopName} → {transportAssignment.dropoffStopName}</span></article>{transportTrips.map(trip=><article className="document-row" key={trip.id}><strong>{trip.serviceDate} · {trip.direction}</strong><span>{trip.status.replaceAll("_"," ")}{trip.scheduledDeparture?" · "+trip.scheduledDeparture:""}</span></article>)}</>:<p>{t("No active school transport assignment is linked to this learner.","Aucun transport scolaire actif n’est associé à cet élève.")}</p>}</section><section className="panel"><div className="panel-title"><UsersRound/><div><span>SAFE PICKUP</span><h3>{t("People allowed to collect","Personnes autorisées à récupérer l’enfant")}</h3></div></div>{pickupCircle.map(member=><article className="document-row" key={member.collectorId}><strong>{member.fullName} · {member.relationship}</strong><span>{member.status} · valid to {dateText(member.validUntil)}</span></article>)}{!pickupCircle.length&&!familyLoading&&!familyError?<p>{t("No approved pickup person is listed yet.","Aucune personne autorisée pour la récupération n’est encore enregistrée.")}</p>:null}</section></section>:null}
 </div>;
}
