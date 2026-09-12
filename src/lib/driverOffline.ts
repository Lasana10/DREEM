import type { Role } from "../domain/types";
import { enqueueOffline, replayOffline, type OfflineOperation } from "./offlineOutbox";
import { progressTransportTrip } from "./repository";
import { requireCachedSchoolContext, resolveActiveSchoolContext } from "./schoolContext";
import { isSupabaseConfigured, supabase } from "./supabase";

type JourneyCommand=Parameters<typeof progressTransportTrip>[0];
type Viewer={id?:string;role:Role};
const JOURNEY_EVENT="driver.progress_transport_trip";

function viewerContext(viewer:Viewer){if(!viewer.id)throw new Error("Driver identity is unavailable.");if(viewer.role!=="driver")throw new Error("Only the authenticated Driver app can queue driver journey work.");return requireCachedSchoolContext(viewer.id,viewer.role);}
export async function prepareDriverOfflineContext(){if(typeof navigator!=="undefined"&&!navigator.onLine)return;const context=await resolveActiveSchoolContext();if(context.role!=="driver")throw new Error("The selected school membership is not a Driver role.");}
export async function progressTransportTripResilient(command:JourneyCommand,viewer:Viewer):Promise<{queued:boolean}>{if(typeof navigator==="undefined"||navigator.onLine){await progressTransportTrip(command);return{queued:false};}const context=viewerContext(viewer);await enqueueOffline({schoolId:context.schoolId,actorId:context.userId,role:context.role,entity:"transport_trip",command:JOURNEY_EVENT,payload:command,idempotencyKey:command.idempotencyKey});return{queued:true};}

async function ingestDriverEvent(payload:JourneyCommand,operation:OfflineOperation){
 if(!isSupabaseConfigured||!supabase)throw new Error("DREEM is not connected to the school server.");
 const{error}=await supabase.rpc("dreem_ingest_driver_offline_event",{p_school_id:operation.schoolId,p_trip_id:payload.tripId,p_event_type:payload.eventType,p_stop_id:payload.stopId||null,p_student_id:payload.studentId||null,p_note:payload.note||"",p_captured_at:operation.createdAt,p_device_id:operation.deviceId,p_payload_digest:operation.payloadDigest,p_idempotency_key:operation.idempotencyKey});if(error)throw error;
}
export async function replayDriverOffline(viewer:Viewer){if(!viewer.id)return{synced:0,failed:0,tampered:0};const context=await resolveActiveSchoolContext();if(context.userId!==viewer.id||context.role!=="driver")throw new Error("Queued driver work belongs to a different active school or account.");return replayOffline({schoolId:context.schoolId,actorId:context.userId},{[JOURNEY_EVENT]:(payload,operation)=>ingestDriverEvent(payload as JourneyCommand,operation)});}
