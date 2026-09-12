import type { Role } from "../domain/types";
import { enqueueOffline, replayOffline, type OfflineOperation } from "./offlineOutbox";
import { deviceId } from "./offlineOutbox";
import { requireCachedSchoolContext, resolveActiveSchoolContext } from "./schoolContext";
import { isSupabaseConfigured, supabase } from "./supabase";

type Viewer={id?:string;role:Role};
type GateDenialPayload={credentialDigest:string;collectorDigest?:string;reason:string;capturedAt:string;deviceId:string;idempotencyKey:string};
const COMMAND="gate.record_offline_denial";

async function digest(value:string){
  const data=new TextEncoder().encode(value.trim());
  const hash=await crypto.subtle.digest("SHA-256",data);
  return Array.from(new Uint8Array(hash)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

export async function prepareGateOfflineContext(){
  if(typeof navigator!=="undefined"&&!navigator.onLine)return;
  await resolveActiveSchoolContext();
}

export async function queueOfflineGateDenial(input:{credentialToken:string;collectorToken?:string;reason:string;idempotencyKey:string},viewer:Viewer){
  if(!viewer.id)throw new Error("Gate identity is unavailable.");
  const context=requireCachedSchoolContext(viewer.id,viewer.role);
  const payload:GateDenialPayload={credentialDigest:await digest(input.credentialToken),collectorDigest:input.collectorToken?.trim()?await digest(input.collectorToken):undefined,reason:input.reason.trim(),capturedAt:new Date().toISOString(),deviceId:deviceId(),idempotencyKey:input.idempotencyKey};
  await enqueueOffline({schoolId:context.schoolId,actorId:context.userId,role:context.role,entity:"gate_offline_incident",command:COMMAND,payload,idempotencyKey:input.idempotencyKey});
  return {queued:true as const};
}

async function ingest(payload:GateDenialPayload,operation:OfflineOperation){
  if(!isSupabaseConfigured||!supabase)throw new Error("DREEM is not connected to the school server.");
  const {error}=await supabase.rpc("dreem_ingest_gate_offline_denial",{p_school_id:operation.schoolId,p_credential_digest:payload.credentialDigest,p_collector_digest:payload.collectorDigest??null,p_reason:payload.reason,p_captured_at:payload.capturedAt,p_device_id:payload.deviceId,p_idempotency_key:payload.idempotencyKey});
  if(error)throw error;
}

export async function replayGateOffline(viewer:Viewer){
  if(!viewer.id)return{synced:0,failed:0,tampered:0};
  const context=await resolveActiveSchoolContext();
  if(context.userId!==viewer.id)throw new Error("Offline gate evidence belongs to a different signed-in account.");
  return replayOffline({schoolId:context.schoolId,actorId:context.userId},{[COMMAND]:(payload,operation)=>ingest(payload as GateDenialPayload,operation)});
}
