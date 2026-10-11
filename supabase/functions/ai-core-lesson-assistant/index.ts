import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.90.1";
const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type,x-client-info"}});
const subjects=new Set(["mathematics","english","french","science","history","geography"]);
const levels=new Set(["primary","secondary"]);
const modes=new Set(["lesson-outline","revision-questions"]);
const roles=new Set(["teacher","tutor","academic_head","principal","administrator","school_owner"]);
function isId(s:unknown):s is string{return typeof s==="string"&&/^[A-Za-z0-9_-]{2,64}$/.test(s);}
async function signature(product:string,tenant:string,time:string,key:string){
 const bytes=new TextEncoder();
 const secret=await crypto.subtle.importKey("raw",bytes.encode(key),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signed=await crypto.subtle.sign("HMAC",secret,bytes.encode(JSON.stringify([product,tenant,time])));
 return [...new Uint8Array(signed)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return respond({},200);
 if(req.method!=="POST")return respond({error:"METHOD_NOT_ALLOWED"},405);
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token)return respond({error:"AUTH_REQUIRED"},401);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY");
 const coreUrl=Deno.env.get("AI_CORE_URL"),coreKey=Deno.env.get("AI_CORE_KEY_DREEM");
 if(!url||!anon||!coreUrl||!coreKey)return respond({error:"CONFIGURATION_REQUIRED"},503);
 const client=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}}});
 const {data:auth,error:authError}=await client.auth.getUser(token);
 if(authError||!auth.user)return respond({error:"AUTH_REQUIRED"},401);
 let body:Record<string,unknown>;
 try{body=await req.json();}catch{return respond({error:"INVALID_JSON"},400);}
 const schoolId=body.schoolId;
 if(!isId(schoolId))return respond({error:"INVALID_SCHOOL"},400);
 const {data:member,error}=await client.from("dreem_school_memberships")
  .select("school_id,role,status").eq("school_id",schoolId).eq("profile_id",auth.user.id).maybeSingle();
 if(error||!member||!roles.has(String(member.role))||!["active","accepted"].includes(String(member.status)))return respond({error:"SCHOOL_ACCESS_DENIED"},403);
 const subject=String(body.subject||"").toLowerCase(),level=String(body.level||"").toLowerCase(),mode=String(body.mode||"");
 if(!subjects.has(subject)||!levels.has(level)||!modes.has(mode))return respond({error:"UNSUPPORTED_LESSON_REQUEST"},400);
 const prompt=mode==="lesson-outline"
  ?`Produce a bilingual English/French general ${level} ${subject} lesson outline with objectives, classroom activity, accessible explanations and formative checks. Do not invent curriculum mandates or student records.`
  :`Produce 8 bilingual English/French practice questions and answer explanations for general ${level} ${subject}. Do not invent curriculum mandates or student records.`;
 const core=new URL(coreUrl);
 if(core.protocol!=="https:")return respond({error:"CORE_HTTPS_REQUIRED"},503);
 const time=String(Date.now()),sig=await signature("DREEM",schoolId,time,coreKey);
 try{
  const res=await fetch(new URL("/v1/infer",core),{method:"POST",signal:AbortSignal.timeout(35000),
   headers:{"content-type":"application/json","x-ai-product":"DREEM","x-ai-key":coreKey,"x-ai-tenant":schoolId,"x-ai-timestamp":time,"x-ai-tenant-signature":sig},
   body:JSON.stringify({task:"education",sensitivity:"public",approvedExternalProcessing:false,prompt})});
  const data=await res.json();
  if(!res.ok)return respond({error:typeof data.error==="string"?data.error:"AI_CORE_UNAVAILABLE"},res.status>=500?503:res.status);
  if(typeof data.output!=="string")return respond({error:"INVALID_AI_RESULT"},502);
  return respond({output:data.output,requiresHumanReview:true,requestId:data.requestId,model:data.model});
 }catch{return respond({error:"AI_CORE_UNAVAILABLE"},503);}
});
