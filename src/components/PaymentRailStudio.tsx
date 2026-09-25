import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, CreditCard, ShieldCheck } from "lucide-react";
import { loadPaymentRails, savePaymentRail, type PaymentRailConfig } from "../lib/paymentRails";

const label=(code:PaymentRailConfig["code"])=>({cash:"Cash desk",wave:"Wave",mtn_momo:"MTN MoMo",orange_money:"Orange Money",bank:"Bank / merchant account",card:"Card",cheque:"Cheque",other:"Other"}[code]);

export default function PaymentRailStudio(){
  const[rails,setRails]=useState<PaymentRailConfig[]>([]),[busy,setBusy]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState("");
  async function reload(){setRails(await loadPaymentRails())}
  useEffect(()=>{void reload().catch(reason=>setError(reason instanceof Error?reason.message:"Payment rails could not be loaded."))},[]);
  async function save(event:FormEvent<HTMLFormElement>,rail:PaymentRailConfig){
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(rail.id);setError("");setMessage("");
    try{
      await savePaymentRail({code:rail.code,name:String(form.get("name")??rail.name),merchantReference:String(form.get("merchantReference")??""),enabled:rail.code==="cash"?true:form.get("enabled")==="on",priority:Number(form.get("priority")??rail.priority)});
      await reload();setMessage(`${label(rail.code)} configuration saved.`);
    }catch(reason){setError(reason instanceof Error?reason.message:"Payment rail could not be saved.");}
    finally{setBusy("")}
  }
  return <section className="panel payment-rail-studio">
    <div className="panel-title"><CreditCard/><div><span>PAYMENT RAILS</span><h3>Enable only accounts the school really controls</h3><p>DREEM stores the school-facing merchant/account reference here. Provider API keys, webhook secrets and settlement credentials stay server-side.</p></div></div>
    <div className="care-assurance"><ShieldCheck/><span><strong>Configuration is not settlement proof</strong><small>Enabling a rail permits collection against it; signed provider callbacks and reconciliation remain separate evidence.</small></span></div>
    {error?<div className="form-status error" role="alert">{error}</div>:null}{message?<div className="form-status success"><BadgeCheck/>{message}</div>:null}
    <div className="payment-rail-grid">{rails.map(rail=><form className="subform" key={rail.id} onSubmit={event=>void save(event,rail)}>
      <strong>{label(rail.code)}</strong><small>{rail.type.replaceAll("_"," ")}</small>
      <label>Display name<input name="name" defaultValue={rail.name} required/></label>
      {rail.code!=="cash"?<label>Institutional merchant / account reference<input name="merchantReference" defaultValue={rail.merchantReference} placeholder="School-controlled merchant or bank reference"/></label>:null}
      <label>Priority<input name="priority" type="number" min="0" step="1" defaultValue={rail.priority}/></label>
      <label className="toggle-row"><span>{rail.code==="cash"?"Cash desk enabled":"Enable for collection"}</span><input name="enabled" type="checkbox" defaultChecked={rail.enabled||rail.code==="cash"} disabled={rail.code==="cash"}/></label>
      <button className="primary" disabled={busy===rail.id}>{busy===rail.id?"Saving…":"Save rail"}</button>
    </form>)}</div>
  </section>;
}
