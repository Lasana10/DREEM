import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const origin=Deno.env.get("DREEM_PUBLIC_ORIGIN")||"https://dreem-school-os.pages.dev";
const headers={"content-type":"application/json","access-control-allow-origin":origin,"vary":"Origin","access-control-allow-headers":"authorization,apikey,content-type,x-client-info","access-control-allow-methods":"POST,OPTIONS"};
const reply=(status:number,error:string)=>new Response(JSON.stringify({error}),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async(req:Request)=>{
 if(req.headers.get("origin")!==origin)return reply(403,"Origin not allowed");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply(405,"POST required");
 const secret=Deno.env.get("TURNSTILE_SECRET_KEY")||"";
 const hmacSecret=Deno.env.get("PTA_VOTE_HMAC_SECRET")||"";
 const url=Deno.env.get("SUPABASE_URL")||"";
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!secret||hmacSecret.length<32||!url||!key)return reply(503,"Voting not configured");
 let input:Record<string,unknown>;
 try{input=await req.json() as Record<string,unknown>;}catch{return reply(400,"Invalid JSON");}
 const proposalId=String(input.proposalId||""),voterId=String(input.voterId||""),choice=String(input.choice||""),token=String(input.turnstileToken||"");
 if(!uuid.test(proposalId)||!uuid.test(voterId)||!["support","oppose","abstain"].includes(choice)||token.length<5||token.length>3000)return reply(400,"Invalid ballot");
 try{
  const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:new URLSearchParams({secret,response:token}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)return reply(503,"Verification unavailable");
  const result=await response.json() as {success?:boolean;hostname?:string};
  if(result.success!==true||result.hostname!==new URL(origin).hostname)return reply(403,"Verification rejected");
 }catch{return reply(503,"Verification unavailable");}
 // One browser identity per proposal, domain-separated by proposal ID. Do not expose raw ID.
 const encoder=new TextEncoder();
 const cryptoKey=await crypto.subtle.importKey("raw",encoder.encode(hmacSecret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const digest=Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",cryptoKey,encoder.encode(proposalId+":"+voterId)))).map(b=>b.toString(16).padStart(2,"0")).join("");
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await admin.rpc("dreem_pta_record_ballot",{p_proposal_id:proposalId,p_voter_digest:digest,p_choice:choice});
 if(error)return reply(400,"Poll unavailable");
 return new Response(JSON.stringify({recorded:data===true,duplicate:data===false}),{status:200,headers});
});
