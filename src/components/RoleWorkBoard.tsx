import {useState} from "react";
import {ArrowRight,ClipboardCheck,Clock3,CheckCircle2} from "lucide-react";
import type {WorkspaceData} from "../lib/repository";
import {roleWorkQueues,type WorkLane} from "../lib/roleWorkQueues";
import {useLanguage} from "../lib/useLanguage";
import type {ViewKey} from "./Shell";

const labels:Record<WorkLane,{en:string;fr:string}>={
 needs:{en:"Needs me",fr:"À traiter"},
 waiting:{en:"Waiting",fr:"En attente"},
 done:{en:"Done",fr:"Terminé"},
};
const translated:Record<string,{fr:string;detailFr:string}>={
 "lesson-approval":{fr:"Vérifier les préparations de cours",detailFr:"Préparations remises pour validation pédagogique indépendante."},
 "assessment-moderation":{fr:"Modérer les évaluations",detailFr:"Les notes soumises nécessitent une validation indépendante avant publication."},
 "academic-reviewed":{fr:"Préparations vérifiées",detailFr:"Justificatifs pédagogiques déjà examinés."},
 "academic-published":{fr:"Évaluations publiées",detailFr:"Évaluations publiées après validation."},
 "teacher-grading":{fr:"Corriger les travaux des élèves",detailFr:"Travaux remis dans les classes qui vous sont attribuées."},
 "teacher-returned":{fr:"Corriger les préparations retournées",detailFr:"Le responsable pédagogique a demandé des modifications."},
 "teacher-awaiting":{fr:"Préparations en cours de validation",detailFr:"Vos préparations attendent une vérification indépendante."},
 "teacher-assessment-awaiting":{fr:"Évaluations en cours de modération",detailFr:"Vos évaluations attendent une validation indépendante."},
 "teacher-reviewed":{fr:"Préparations validées",detailFr:"Vos préparations ont été examinées."},
 "teacher-graded":{fr:"Travaux corrigés",detailFr:"Travaux corrigés dans les classes qui vous sont attribuées."},
 "admissions-decision":{fr:"Décisions d'admission attendues",detailFr:"Dossiers nécessitant une décision d'admission autorisée."},
 "admissions-decided":{fr:"Décisions d'admission prises",detailFr:"Candidatures acceptées, inscrites ou refusées."},
 "admissions-documents":{fr:"Compléter les dossiers d'admission",detailFr:"Dossiers à préparer ou pièces manquantes."},
 "admissions-waiting":{fr:"Admissions en attente de décision",detailFr:"Dossiers préparés et transmis à la direction."},
 "finance-exceptions":{fr:"Contrôler les exceptions financières",detailFr:"Écarts nécessitant un contrôle indépendant."},
 "finance-settlement":{fr:"Espèces en attente de confirmation",detailFr:"Fonds reçus en attente de validation ou justificatif de dépôt."},
 "transport-delays":{fr:"Examiner les trajets retardés",detailFr:"Incidents de transport à traiter par le responsable."},
 "transport-awaiting":{fr:"Trajets en cours",detailFr:"Trajets annoncés ou en cours d'exécution."},
 "transport-completed":{fr:"Trajets terminés",detailFr:"Trajets enregistrés comme terminés."},
 "urgent-care":{fr:"Protection urgente des élèves",detailFr:"Situations urgentes non résolues à examiner par une personne habilitée."},
};

export default function RoleWorkBoard({workspace,onNavigate}:{workspace:WorkspaceData;onNavigate:(view:ViewKey)=>void}){
 const {language,text}=useLanguage();
 const [lane,setLane]=useState<WorkLane>("needs");
 const items=roleWorkQueues(workspace);
 const visible=items.filter(item=>item.lane===lane).sort((a,b)=>(a.priority==="urgent"?0:1)-(b.priority==="urgent"?0:1));
 const number=(state:WorkLane)=>items.filter(item=>item.lane===state).reduce((n,item)=>n+item.count,0);
 return <section className="focus-card role-work-board" aria-label={text("My work","Mon travail")} style={{marginTop:14}}>
  <div className="panel-title"><ClipboardCheck/><div><span>{text("MY WORK","MON TRAVAIL")}</span><h3>{text("What belongs to me","Les tâches qui me concernent")}</h3><p>{text("School work assigned by responsibility, not simply every page you can open.","Les tâches selon vos responsabilités, et non toutes les pages accessibles.")}</p></div></div>
  <div className="workspace-tabs" role="tablist" aria-label={text("Work status","État des tâches")}>
   {(["needs","waiting","done"] as WorkLane[]).map(state=><button key={state} role="tab" aria-selected={lane===state} className={lane===state?"active":""} onClick={()=>setLane(state)}>
    {state==="needs"?<ClipboardCheck size={16}/>:state==="waiting"?<Clock3 size={16}/>:<CheckCircle2 size={16}/>}
    {language==="fr"?labels[state].fr:labels[state].en} <span className="status-pill">{number(state)}</span>
   </button>)}
  </div>
  <div role="tabpanel" aria-label={language==="fr"?labels[lane].fr:labels[lane].en}>
   {visible.length?<div className="action-list">{visible.map(item=><article className="action-row" key={item.id}>
    <div className="action-icon">{item.lane==="done"?<CheckCircle2/>:item.lane==="waiting"?<Clock3/>:<ClipboardCheck/>}</div>
    <div><strong>{language==="fr"?(translated[item.id]?.fr??item.title):item.title}</strong><small>{language==="fr"?(translated[item.id]?.detailFr??item.detail):item.detail} · {item.count} {text(item.count===1?"record":"records",item.count===1?"dossier":"dossiers")}</small></div>
    <button type="button" onClick={()=>onNavigate(item.view as ViewKey)}>{text("Open","Ouvrir")} <ArrowRight size={16}/></button>
   </article>)}</div>:<p className="quiet-note" role="status">{text("No recorded tasks in this category. This is not a confirmation that other school processes are complete.","Aucune tâche enregistrée dans cette catégorie. Cela ne confirme pas l'achèvement des autres processus scolaires.")}</p>}
  </div>
 </section>;
}
