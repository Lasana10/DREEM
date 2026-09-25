import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});

async function providerWebhook(url:string,token:string|undefined,payload:unknown){
  const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(payload)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(String((result as {message?:string})?.message??`Provider returned ${response.status}`));
  return String((result as {id?:string;messageId?:string})?.id??(result as {messageId?:string})?.messageId??"");
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json({error:"POST required"},405);

  const url=Deno.env.get("SUPABASE_URL")??"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")??"";
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
  if(!url||!serviceKey)return json({error:"Server configuration unavailable"},503);

  const auth=req.headers.get("authorization")??"";
  const token=auth.replace(/^Bearer\s+/i,"");
  if(!token)return json({error:"Authentication required"},401);

  let input:{schoolId?:string;limit?:number}={};
  try{input=await req.json();}catch{/* handled below */}
  if(!input.schoolId)return json({error:"schoolId is required"},400);

  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
  if(token!==serviceKey){
    if(!anon)return json({error:"Public client configuration unavailable"},503);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
    const{data:userData,error:userError}=await userClient.auth.getUser();
    if(userError||!userData.user)return json({error:"Invalid session"},401);
    const checks=await Promise.all(["communications_publish","communications_approve","institutional_leadership"].map(scope=>userClient.rpc("dreem_has_authority",{p_school_id:input.schoolId,p_scope:scope})));
    if(!checks.some(item=>item.data===true))return json({error:"School communications authority required"},403);
  }

  const limit=Math.max(1,Math.min(Number(input.limit??50),200));
  const{data:deliveries,error:deliveryError}=await admin.from("dreem_notification_deliveries")
    .select("id,school_id,announcement_id,recipient_user_id,channel,status,attempts")
    .eq("school_id",input.schoolId).in("status",["queued","retrying"]).neq("channel","in_app").order("queued_at").limit(limit);
  if(deliveryError)return json({error:deliveryError.message},500);

  let sent=0,failed=0,waitingForProvider=0;
  for(const delivery of deliveries??[]){
    const[{data:announcement},{data:endpoint}]=await Promise.all([
      admin.from("dreem_announcements").select("title,body,priority,category").eq("id",delivery.announcement_id).maybeSingle(),
      admin.from("dreem_notification_endpoints").select("endpoint").eq("school_id",delivery.school_id).eq("user_id",delivery.recipient_user_id).eq("channel",delivery.channel).eq("enabled",true).eq("verified",true).limit(1).maybeSingle()
    ]);
    if(!announcement||!endpoint){
      await admin.from("dreem_notification_deliveries").update({status:"failed",last_error:"Verified endpoint or announcement unavailable",attempts:Number(delivery.attempts??0)+1,updated_at:new Date().toISOString()}).eq("id",delivery.id);
      failed++;continue;
    }
    try{
      let providerMessageId="";
      if(delivery.channel==="email"){
        const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("DREEM_FROM_EMAIL");
        if(!key||!from)throw new Error("Email provider is not configured");
        const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify({from,to:[endpoint.endpoint],subject:announcement.title,text:announcement.body})});
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(String((result as {message?:string})?.message??`Email provider returned ${response.status}`));
        providerMessageId=String((result as {id?:string})?.id??"");
      }else{
        const prefix=String(delivery.channel).toUpperCase();
        const webhook=Deno.env.get(`${prefix}_WEBHOOK_URL`),providerToken=Deno.env.get(`${prefix}_WEBHOOK_TOKEN`);
        if(!webhook)throw new Error(`${delivery.channel} provider is not configured`);
        providerMessageId=await providerWebhook(webhook,providerToken,{to:endpoint.endpoint,title:announcement.title,message:announcement.body,priority:announcement.priority,category:announcement.category,deliveryId:delivery.id});
      }
      await admin.from("dreem_notification_deliveries").update({status:"sent",provider_message_id:providerMessageId||null,sent_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",delivery.id);
      sent++;
    }catch(reason){
      const message=reason instanceof Error?reason.message:"Provider delivery failed";
      await admin.from("dreem_notification_deliveries").update({status:"retrying",last_error:message,attempts:Number(delivery.attempts??0)+1,updated_at:new Date().toISOString()}).eq("id",delivery.id);
      if(message.includes("not configured"))waitingForProvider++;else failed++;
    }
  }

  const now=new Date().toISOString();
  const{data:confirmations,error:confirmationError}=await admin.from("dreem_payment_confirmations")
    .select("id,payment_id,confirmation_token,delivery_status,expires_at")
    .eq("school_id",input.schoolId).eq("delivery_channel","sms").eq("acknowledgement_status","pending")
    .in("delivery_status",["queued","failed"]).gt("expires_at",now).limit(limit);
  if(confirmationError)return json({error:confirmationError.message,announcements:{sent,failed,waitingForProvider}},500);

  let witnessSent=0,witnessFailed=0,witnessWaiting=0;
  const smsWebhook=Deno.env.get("SMS_WEBHOOK_URL"),smsToken=Deno.env.get("SMS_WEBHOOK_TOKEN"),appUrl=(Deno.env.get("DREEM_APP_URL")??"").replace(/\/$/,"");
  for(const confirmation of confirmations??[]){
    try{
      if(!smsWebhook||!appUrl)throw new Error("SMS payment-witness delivery is not configured");
      const{data:payment,error:paymentError}=await admin.from("dreem_financial_payments").select("receipt_number,payer_phone,amount").eq("id",confirmation.payment_id).eq("school_id",input.schoolId).maybeSingle();
      if(paymentError)throw paymentError;
      if(!payment?.payer_phone)throw new Error("Payer phone is unavailable");
      const link=`${appUrl}/payment/ack/${confirmation.confirmation_token}`;
      const message=`DREEM receipt ${payment.receipt_number}: please confirm or dispute this school payment: ${link}`;
      await providerWebhook(smsWebhook,smsToken,{to:payment.payer_phone,message,category:"payment_acknowledgement",confirmationId:confirmation.id});
      await admin.from("dreem_payment_confirmations").update({delivery_status:"sent"}).eq("id",confirmation.id).eq("acknowledgement_status","pending");
      witnessSent++;
    }catch(reason){
      const message=reason instanceof Error?reason.message:"Payment witness delivery failed";
      await admin.from("dreem_payment_confirmations").update({delivery_status:"failed"}).eq("id",confirmation.id).eq("acknowledgement_status","pending");
      if(message.includes("not configured"))witnessWaiting++;else witnessFailed++;
    }
  }

  return json({
    announcements:{processed:(deliveries??[]).length,sent,failed,waitingForProvider},
    paymentWitnesses:{processed:(confirmations??[]).length,sent:witnessSent,failed:witnessFailed,waitingForProvider:witnessWaiting}
  });
});
