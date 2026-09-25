import { useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, ReceiptText, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

function tokenFromLocation(){
  const match=window.location.pathname.match(/^\/payment\/ack\/([0-9a-fA-F-]{36})\/?$/);
  return match?.[1]??"";
}

export default function PaymentAcknowledgement(){
  const token=useMemo(tokenFromLocation,[]);
  const[busy,setBusy]=useState(false),[result,setResult]=useState<"confirmed"|"disputed"|"" >(""),[error,setError]=useState("");

  async function acknowledge(action:"confirmed"|"disputed"){
    setBusy(true);setError("");
    try{
      if(!token)throw new Error("This payment confirmation link is invalid.");
      if(!isSupabaseConfigured||!supabase)throw new Error("DREEM confirmation service is unavailable.");
      const{data,error:rpcError}=await supabase.rpc("dreem_acknowledge_payment",{p_confirmation_token:token,p_action:action});
      if(rpcError)throw rpcError;
      if(data!==true)throw new Error("This confirmation link has expired, was already used, or is no longer valid.");
      setResult(action);
    }catch(reason){setError(reason instanceof Error?reason.message:"Payment confirmation could not be recorded.");}
    finally{setBusy(false);}
  }

  return <main className="auth-screen payment-ack-screen"><section className="auth-card payment-ack-card">
    <strong>DREEM VERIFIED MONEY TRAIL</strong>
    <ReceiptText size={40}/>
    <h1>{result==="confirmed"?"Payment confirmed":result==="disputed"?"Payment disputed":"Confirm this school payment"}</h1>
    {result?<div className={`form-status ${result==="confirmed"?"success":"error"}`}>{result==="confirmed"?<BadgeCheck/>:<AlertTriangle/>}<span>{result==="confirmed"?"Your confirmation is now part of the school payment evidence.":"Your dispute has been recorded for independent follow-up by the school."}</span></div>:<>
      <p>This secure link records only whether you recognize the receipt. It does not ask for a password, PIN, card number or mobile-money secret.</p>
      {error?<div className="form-status error" role="alert"><AlertTriangle/>{error}</div>:null}
      <div className="care-assurance"><ShieldCheck/><span><strong>One-time acknowledgement</strong><small>Expired or previously used links cannot change the payment record again.</small></span></div>
      <div className="payment-ack-actions">
        <button className="primary" disabled={busy||!token} onClick={()=>void acknowledge("confirmed")}><BadgeCheck/>{busy?"Recording…":"I recognize this payment"}</button>
        <button className="secondary" disabled={busy||!token} onClick={()=>void acknowledge("disputed")}><AlertTriangle/>I do not recognize it</button>
      </div>
    </>}
  </section></main>;
}
