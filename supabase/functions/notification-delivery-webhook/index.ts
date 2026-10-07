import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json({error:"POST required"},405);
  const secret=Deno.env.get("NOTIFICATION_WEBHOOK_SECRET")??"";
  const supplied=req.headers.get("x-dreem-webhook-secret")??"";
  if(!secret)return json({error:"Notification webhook is not configured"},503);
  if(!supplied||supplied!==secret)return json({error:"Invalid webhook secret"},401);
  const url=Deno.env.get("SUPABASE_URL")??"",serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
  if(!url||!serviceKey)return json({error:"Server configuration unavailable"},503);
  let input:{deliveryId?:string;status?:string;providerMessageId?:string;error?:string}={};
  try{input=await req.json();}catch{return json({error:"Invalid JSON"},400);}
  if(!input.deliveryId||!["delivered","failed"].includes(String(input.status)))return json({error:"deliveryId and delivered/failed status are required"},400);
  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
  const patch=input.status==="delivered"
    ?{status:"delivered",provider_message_id:input.providerMessageId||null,delivered_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}
    :{status:"failed",provider_message_id:input.providerMessageId||null,last_error:input.error||"Provider reported failure",updated_at:new Date().toISOString()};
  const{data,error}=await admin.from("dreem_notification_deliveries").update(patch).eq("id",input.deliveryId).select("id,status").maybeSingle();
  if(error)return json({error:error.message},500);
  if(!data)return json({error:"Delivery not found"},404);
  return json({deliveryId:data.id,status:data.status});
});