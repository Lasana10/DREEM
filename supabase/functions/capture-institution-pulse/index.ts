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

  const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
  const{data,error}=await admin.rpc("dreem_capture_all_institution_pulses");
  if(error)return json({error:error.message},500);

  return json({
    captured:Number(data??0),
    capturedAt:new Date().toISOString()
  });
});
