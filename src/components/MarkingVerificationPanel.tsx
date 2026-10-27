import { useEffect, useState, type FormEvent } from "react";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { listMarkingChecks,recordMarkingCheck,type MarkingCheck,type WeeklyRegister } from "../lib/weeklyRegisters";
import { userFacingError } from "../lib/userFacingError";
export default function MarkingVerificationPanel({registers,reviewer,viewerId}:{registers:WeeklyRegister[];reviewer:boolean;viewerId?:string}){
 const [checks,setChecks]=useState<MarkingCheck[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState("");
 const registerIds=registers.map(x=>x.id).join(",");
 useEffect(()=>{let active=true;if(!registerIds){return;}
  setLoading(true);
  listMarkingChecks(registerIds.split(",")).then(rows=>{if(active){setChecks(rows);setError("");}}).catch(reason=>{if(active)setError(userFacingError(reason,"Marking verification records could not be loaded."));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[registerIds]);
 async function submit(event:FormEvent<HTMLFormElement>,register:WeeklyRegister){
  event.preventDefault();const form=event.currentTarget,f=new FormData(form);
  setBusy(true);setError("");setMessage("");
  try{
   await recordMarkingCheck({registerId:register.id,sampledBooks:Number(f.get("sampledBooks")),decision:String(f.get("decision")) as MarkingCheck["decision"],reference:String(f.get("reference")),findings:String(f.get("findings"))});
   setChecks(await listMarkingChecks(registerIds.split(",")));
   form.reset();setMessage("Marking evidence check recorded independently.");
  }catch(reason){setError(userFacingError(reason,"Marking verification was not recorded."));}
  finally{setBusy(false);}
 }
 return <section className="excellence-marking-verify" aria-label="Verified exercise-book marking">
  <div className="excellence-register-header"><div><span className="excellence-kicker-dark"><ShieldCheck size={15}/> EVIDENCE-BASED SUPERVISION</span><h2>Marking verification</h2><p>Separate teacher-reported marking from independently sampled exercise books or equivalent recorded work.</p></div></div>
  {error&&<p className="form-status error" role="alert">{error}</p>}{message&&<p className="form-status success" role="status">{message}</p>}
  {loading&&<p role="status">Loading verification records…</p>}
  {registers.length===0?<p className="excellence-weekly-disclaimer">A teacher must submit a weekly register before marking can be independently sampled.</p>:registers.map(register=>{
   const related=checks.filter(x=>x.register_id===register.id);
   return <article key={register.id} className="excellence-register-item"><div className="excellence-register-item-top"><div><strong>Week of {register.week_start}</strong><small>Teacher reports: {register.marking_state.replace("_"," ")} · {register.exercises_assigned} exercises assigned</small></div><span className="excellence-register-state">{related.length?"Verification recorded":"Not verified"}</span></div>
    {related.length>0&&<div className="excellence-marking-checks">{related.map(x=><div key={x.id}><span><ClipboardCheck size={15}/> {x.decision.replace("_"," ")} · {x.sampled_books} sampled</span><small>{new Date(x.checked_at).toLocaleDateString()} · {x.evidence_reference}</small><p>{x.findings}</p></div>)}</div>}
    {reviewer&&register.submitted_by!==viewerId&&<form className="excellence-marking-form" onSubmit={e=>void submit(e,register)}>
      <div className="excellence-register-fields"><label>Books / pieces of work checked<input name="sampledBooks" type="number" min="1" max="200" required/></label>
      <label>Finding<select name="decision"><option value="verified">Sample verified</option><option value="needs_correction">Correction needed</option><option value="inconclusive">Insufficient evidence</option></select></label>
      <label>Evidence reference<input name="reference" minLength={5} maxLength={500} required placeholder="Class, exercise book or worksheet reference"/></label></div>
      <label>What was actually checked?<textarea name="findings" minLength={10} maxLength={2000} required rows={2} placeholder="Document sample, dates, completeness, errors and necessary follow-up"/></label>
      <button type="submit" className="excellence-register-action" disabled={busy}>Record independent check</button>
    </form>}
   </article>;
  })}
  <p className="excellence-weekly-disclaimer">Sample verification does not certify every exercise or change official pupil scores. Checks preserve the reviewer, sample size, evidence reference and timestamp.</p>
 </section>;
}
