import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, Database, RefreshCw, ShieldCheck, Wifi } from "lucide-react";
import { loadReleaseManifest, releaseAlignment, type DreemReleaseManifest } from "../lib/releaseManifest";
import { loadTechnicalStatus, type TechnicalStatus } from "../lib/technicalOperations";
import { useLanguage } from "../lib/useLanguage";
import { userFacingError } from "../lib/userFacingError";

export default function ITOperationsView(){
  const{text}=useLanguage();
  const[status,setStatus]=useState<TechnicalStatus|null>(null);
  const[release,setRelease]=useState<DreemReleaseManifest|null>(null);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState("");
  const online=typeof navigator==="undefined"?true:navigator.onLine;
  const alignment=releaseAlignment(release);

  async function refresh(){
    setBusy(true);setError("");
    try{
      const[technical,manifest]=await Promise.all([loadTechnicalStatus(),loadReleaseManifest()]);
      setStatus(technical);setRelease(manifest);
    }catch(reason){setError(userFacingError(reason,text("System status could not be loaded.","L’état du système n’a pas pu être chargé.")));}
    finally{setBusy(false);}
  }
  useEffect(()=>{void refresh();},[]);

  const attention=(status?.failedNotifications??0)+(status?.offlineRejected??0);
  const attentionTitle=attention
    ? text(attention+" technical item"+(attention===1?"":"s")+" need attention",attention+" élément"+(attention===1?"":"s")+" technique"+(attention===1?"":"s")+" à vérifier")
    : text("Systems are reporting normally","Les systèmes fonctionnent normalement");

  return <div className="content role-workspace it-workspace">
    <section className="role-hero"><div><span className="eyebrow">{text("IT · TODAY","IT · AUJOURD’HUI")}</span><h2>{attentionTitle}</h2><p>{text("Check release alignment, delivery queues and offline replay health without opening learner, finance or safeguarding records.","Vérifiez la version, les files de livraison et la synchronisation hors ligne sans ouvrir les dossiers élèves, financiers ou de protection.")}</p></div><button className="primary" onClick={()=>void refresh()} disabled={busy}><RefreshCw/>{busy?text("Checking…","Vérification…"):text("Refresh system check","Actualiser")}</button></section>
    {error?<div className="form-status error" role="alert"><AlertTriangle/>{error}</div>:null}
    <div className="metrics">
      <article className="metric"><span><Wifi/></span><div><small>{text("DEVICE CONNECTION","CONNEXION APPAREIL")}</small><strong>{online?text("Online","En ligne"):text("Offline","Hors ligne")}</strong><p>{online?text("Browser can reach the network.","Le navigateur peut accéder au réseau."):text("Local offline protections remain active.","Les protections hors ligne restent actives.")}</p></div></article>
      <article className="metric"><span><Cloud/></span><div><small>{text("MESSAGE DELIVERY","LIVRAISON DES MESSAGES")}</small><strong>{status?.queuedNotifications??"—"}</strong><p>{text("queued or retrying","en attente ou en nouvelle tentative")}</p></div></article>
      <article className="metric"><span><AlertTriangle/></span><div><small>{text("FAILED DELIVERY","ÉCHECS DE LIVRAISON")}</small><strong>{status?.failedNotifications??"—"}</strong><p>{text("requires operational follow-up","nécessite un suivi opérationnel")}</p></div></article>
      <article className="metric"><span><Database/></span><div><small>{text("OFFLINE REJECTIONS","REJETS HORS LIGNE")}</small><strong>{status?.offlineRejected??"—"}</strong><p>{text("blocked after server recheck","bloqués après contrôle serveur")}</p></div></article>
    </div>
    <div className="split">
      <section className="panel"><div className="panel-title"><ShieldCheck/><div><span>{text("RELEASE TRUTH","VÉRITÉ DE VERSION")}</span><h3>{alignment.label}</h3></div></div><ul className="checks"><li><CheckCircle2/>{text("Database contract","Contrat base de données")}: {release?.databaseContract??text("unverified","non vérifié")}</li><li><CheckCircle2/>{text("Frontend commit","Commit frontend")}: {release?.frontendCommit??text("unverified","non vérifié")}</li><li><CheckCircle2/>{text("Release contract","Contrat de version")}: {release?.releaseContract??text("unverified","non vérifié")}</li></ul></section>
      <section className="panel"><div className="panel-title"><Database/><div><span>{text("OPERATING QUEUES","FILES OPÉRATIONNELLES")}</span><h3>{text("What needs technical follow-up","Ce qui nécessite un suivi technique")}</h3></div></div><div className="money-steps"><article className={(status?.queuedNotifications??0)?"exceptional":"done"}><small>{text("Queued notifications","Notifications en attente")}</small><strong>{status?.queuedNotifications??"—"}</strong></article><article className={(status?.failedNotifications??0)?"exceptional":"done"}><small>{text("Failed notifications","Notifications échouées")}</small><strong>{status?.failedNotifications??"—"}</strong></article><article className={(status?.offlineRejected??0)?"exceptional":"done"}><small>{text("Rejected offline operations","Opérations hors ligne rejetées")}</small><strong>{status?.offlineRejected??"—"}</strong></article><article className="done"><small>{text("Approved school members","Membres approuvés")}</small><strong>{status?.approvedMemberships??"—"}</strong></article></div></section>
    </div>
    <section className="panel"><small>{text("IT authority is intentionally limited to technical operations. This workspace does not grant finance, admissions, academic approval, learner-care or institutional-governance authority.","L’autorité IT est volontairement limitée aux opérations techniques. Cet espace ne donne aucun droit financier, d’admission, d’approbation pédagogique, de suivi sensible des élèves ou de gouvernance institutionnelle.")}</small></section>
  </div>;
}
