import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{"content-type":"application/json","cache-control":"no-store"}
});

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json({error:"POST required"},405);

  const url=Deno.env.get("SUPABASE_URL")??"";
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
  if(!url||!serviceKey)return json({error:"Server configuration unavailable"},503);

  const token=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"");
  if(!token||token!==serviceKey)return json({error:"Service authorization required"},403);

  let input:{limit?:number}={};
  try{input=await req.json();}catch{/* defaults are safe */}
  const limit=Math.max(1,Math.min(Number(input.limit??500),2000));

  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
  const{data,error}=await admin.rpc("dreem_run_policy_engine_system",{p_limit:limit});
  if(error)return json({error:error.message},500);

  const result=Array.isArray(data)?data[0]:data;
  return json({
    processed:Number(result?.processed??0),
    openFindings:Number(result?.open_findings??0),
    failed:Number(result?.failed??0)
  });
});
