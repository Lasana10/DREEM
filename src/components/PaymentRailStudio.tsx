import { useEffect, useState, type FormEvent } from "react";
import { BadgeCheck, CreditCard, ShieldCheck } from "lucide-react";
import { loadPaymentRails, savePaymentRail, type PaymentRailConfig } from "../lib/paymentRails";

const label=(code:PaymentRailConfig["code"])=>({cash:"Cash desk",wave:"Wave",mtn_momo:"MTN MoMo",orange_money:"Orange Money",bank:"Bank / merchant account",card:"Card",cheque:"Cheque",other:"Other"}[code]);

export default function PaymentRailStudio(){
  const[rails,setRails]=useState<PaymentRailConfig[]>([]),[busy,setBusy]=useState(""),[message,setMessage]=useState(""),[error,setError]=useState("");
  async function reload(){setRails(await loadPaymentRails())}
  useEffect(()=>{void reload().catch(reason=>setError(reason instanceof Error?reason.message:"Payment methods could not be loaded."))},[]);
  async function save(event:FormEvent<HTMLFormElement>,rail:PaymentRailConfig){
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(rail.id);setError("");setMessage("");
    try{
      await savePaymentRail({code:rail.code,name:String(form.get("name")??rail.name),merchantReference:String(form.get("merchantReference")??""),enabled:rail.code==="cash"?true:form.get("enabled")==="on",priority:Number(form.get("priority")??rail.priority)});
      await reload();setMessage(`${label(rail.code)} saved.`);
    }catch(reason){setError(reason instanceof Error?reason.message:"Payment method could not be saved.");}
    finally{setBusy("")}
  }
  return <section className="panel payment-rail-studio">
    <div className="panel-title"><CreditCard/><div><span>PAYMENT METHODS</span><h3>Where the school can receive money</h3><p>Keep only the methods your school actually uses. Technical provider secrets remain outside this screen.</p></div></div>
    {error?<div className="form-status error" role="alert">{error}</div>:null}
    {message?<div className="form-status success"><BadgeCheck/>{message}</div>:null}
    <div className="payment-rail-grid">{rails.map(rail=><details className="payment-rail-card" key={rail.id}>
      <summary>
        <span className="payment-rail-icon"><CreditCard size={18}/></span>
        <span><strong>{label(rail.code)}</strong><small>{rail.code==="cash"?"Available at the school":rail.merchantReference||"Account reference not configured"}</small></span>
        <em className={rail.enabled||rail.code==="cash"?"enabled":"disabled"}>{rail.enabled||rail.code==="cash"?"On":"Off"}</em>
      </summary>
      <form onSubmit={event=>void save(event,rail)}>
        <label><span>Display name</span><input name="name" defaultValue={rail.name} required/></label>
        {rail.code!=="cash"?<label><span>School merchant / account reference</span><input name="merchantReference" defaultValue={rail.merchantReference} placeholder="Merchant, MoMo or bank reference"/></label>:null}
        <div className="payment-rail-row">
          <label><span>Order</span><input name="priority" type="number" min="0" step="1" defaultValue={rail.priority}/></label>
          <label className="payment-rail-toggle"><span>{rail.code==="cash"?"Cash desk always available":"Accept payments with this method"}</span><input name="enabled" type="checkbox" defaultChecked={rail.enabled||rail.code==="cash"} disabled={rail.code==="cash"}/></label>
        </div>
        <div className="payment-rail-actions"><button className="primary" disabled={busy===rail.id}>{busy===rail.id?"Saving…":"Save"}</button></div>
      </form>
    </details>)}</div>
    <details className="depth-drawer finance-technical-note"><summary>Technical payment controls</summary><div className="panel"><div className="care-assurance"><ShieldCheck/><span><strong>Configuration is not settlement proof</strong><small>Provider callbacks, reconciliation and settlement confirmation remain separate evidence.</small></span></div></div></details>
  </section>;
}
