import { useEffect, useState, type FormEvent } from "react";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";
import { acknowledgePolicyFinding, loadPolicyFindings, type PolicyFinding } from "../lib/policyEngine";
import { userFacingError } from "../lib/userFacingError";
import { useLanguage } from "../lib/useLanguage";

export default function PolicyFindingQueue(){
  const {text:t}=useLanguage();
  const [findings,setFindings]=useState<PolicyFinding[]>([]),[busy,setBusy]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState(""),[loading,setLoading]=useState(isSupabaseConfigured);
  useEffect(()=>{
    if(!isSupabaseConfigured)return;
    let active=true;
    loadPolicyFindings().then(rows=>{if(active)setFindings(rows)}).catch(reason=>{if(active)setError(userFacingError(reason,"Could not load school follow-up findings."))}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[]);
  async function acknowledge(event:FormEvent<HTMLFormElement>,id:string){
    event.preventDefault();
    const note=String(new FormData(event.currentTarget).get("note")||"").trim();
    setBusy(id);setMessage("");setError("");
    try{
      await acknowledgePolicyFinding(id,note);
      setFindings(await loadPolicyFindings());
      setMessage(t("Acknowledged. The issue remains tracked until it is resolved.","Prise en charge enregistrée. Le dossier reste suivi jusqu’à sa résolution."));
    }catch(reason){setError(userFacingError(reason,"The acknowledgement was not saved."));}
    finally{setBusy("")}
  }
  if(!isSupabaseConfigured)return null;
  if(!loading&&!findings.length&&!error)return null;
  return <section className="panel policy-findings-queue" aria-label={t("Audited school follow-up","Suivi scolaire audité")}>
    <div className="panel-title"><ClipboardCheck/><div><span>{t("PERSISTED SCHOOL FOLLOW-UP","SUIVI INSTITUTIONNEL ENREGISTRÉ")}</span><h3>{t("Work with an accountable owner","Dossiers suivis avec responsable désigné")}</h3></div></div>
    <p>{t("These findings come from the school policy engine and retain a history. Acknowledging responsibility does not resolve the underlying issue.","Ces constats proviennent des règles de l’école et conservent un historique. Prendre en charge ne signifie pas résoudre le problème.")}</p>
    {loading?<p role="status">{t("Loading follow-up records…","Chargement des dossiers…")}</p>:null}
    {error?<div role="alert" className="form-status error">{error}<button type="button" onClick={()=>{setError("");setLoading(true);void loadPolicyFindings().then(setFindings).catch(reason=>setError(userFacingError(reason,"Could not load findings."))).finally(()=>setLoading(false))}}>{t("Retry","Réessayer")}</button></div>:null}
    {message?<div role="status" className="form-status success">{message}</div>:null}
    {findings.map(finding=><details className="finance-review-item" key={finding.id}><summary><span><strong>{finding.title}</strong><small>{finding.domain} · {finding.severity} · {finding.state==="acknowledged"?t("Acknowledged, unresolved","Pris en charge, non résolu"):t("Needs owner","À prendre en charge")}</small></span><span className="finance-review-cta">{t("See evidence","Voir les éléments")}</span></summary>
        <div className="policy-finding-body"><p>{finding.explanation}</p><p><strong>{t("Next action:","Prochaine action :")}</strong> {finding.nextAction}</p><small>{t("Responsible authority:","Responsable habilité :")} {finding.ownerScope}</small>
        {finding.state==="open"?<form onSubmit={event=>void acknowledge(event,finding.id)} className="settings-form"><label>{t("Follow-up note","Note de suivi")}<input name="note" minLength={5} required placeholder={t("Record what you will do next","Indiquez l’action à entreprendre")}/></label><button className="primary" type="submit" disabled={busy!==""}>{t("Acknowledge responsibility","Confirmer la prise en charge")}</button></form>:<p><ShieldCheck size={15}/> {t("Acknowledged, awaiting resolution","Pris en charge, en attente de résolution")}</p>}
        </div>
    </details>)}
  </section>;
}
