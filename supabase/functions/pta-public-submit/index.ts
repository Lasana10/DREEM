import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

// Public intake uses CAPTCHA verification BEFORE a service-role write.
// Do not grant anonymous callers direct execute permission on dreem_pta_submit.
const origin = Deno.env.get("DREEM_PUBLIC_ORIGIN") || "https://dreem-school-os.pages.dev";
const headers = {"content-type":"application/json","access-control-allow-origin":origin,"vary":"Origin","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"};
const reply = (status:number,error:string)=>new Response(JSON.stringify({error}),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async (req:Request)=>{
 const requestOrigin=req.headers.get("origin");
 if(requestOrigin&&requestOrigin!==origin)return reply(403,"Origin not allowed");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply(405,"POST required");
 const secret=Deno.env.get("TURNSTILE_SECRET_KEY")||"";
 const url=Deno.env.get("SUPABASE_URL")||"";
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!secret||!url||!serviceKey)return reply(503,"Public intake security is not configured");
 let input:Record<string,unknown>;
 try{input=await req.json() as Record<string,unknown>;}catch{return reply(400,"Invalid JSON");}
 const campaignId=String(input.campaignId||""),kind=String(input.kind||""),topic=String(input.topic||""),language=String(input.language||""),message=String(input.message||"").trim(),contact=String(input.contact||"").trim(),parentName=String(input.parentName||"").trim(),childrenNames=String(input.childrenNames||"").trim(),childClasses=String(input.childClasses||"").trim(),token=String(input.turnstileToken||"");
 if(!uuid.test(campaignId)||!["concern","idea","question"].includes(kind)||!["learning","facilities","administration","pta","other"].includes(topic)||!["en","fr"].includes(language)||message.length<15||message.length>2000||contact.length>160||parentName.length<2||parentName.length>160||childrenNames.length<2||childrenNames.length>400||childClasses.length>160||token.length<5||token.length>3000)return reply(400,"Invalid input. For child safety emergencies contact the school directly.");
 const verifyBody=new URLSearchParams({secret,response:token});
 let verified=false;
 try{
  const verification=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:verifyBody,signal:AbortSignal.timeout(10000)});
  if(!verification.ok)return reply(503,"Security verification unavailable");
  const outcome=await verification.json() as {success?:boolean;hostname?:string};
  const expectedHost=new URL(origin).hostname;
  verified=outcome.success===true&&outcome.hostname===expectedHost;
 }catch{return reply(503,"Security verification unavailable");}
 if(!verified)return reply(403,"Security verification failed. Please try again.");
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await admin.rpc("dreem_pta_submit_family",{p_campaign_id:campaignId,p_kind:kind,p_topic:topic,p_language:language,p_message:message,p_parent_name:parentName,p_children_names:childrenNames,p_child_classes:childClasses||null,p_contact:contact||null});
 if(error)return reply(400,"Consultation unavailable or submission not accepted");
 if(typeof data!=="string"||!uuid.test(data))return reply(500,"Receipt could not be confirmed");
 return new Response(JSON.stringify({reference:data}),{status:200,headers});
});
