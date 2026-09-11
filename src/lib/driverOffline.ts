import type { Role } from "../domain/types";
import { enqueueOffline, replayOffline } from "./offlineOutbox";
import { progressTransportTrip } from "./repository";
import { requireCachedSchoolContext, resolveActiveSchoolContext } from "./schoolContext";

type JourneyCommand=Parameters<typeof progressTransportTrip>[0];
type Viewer={id?:string;role:Role};
const JOURNEY_EVENT="driver.progress_transport_trip";

function viewerContext(viewer:Viewer){
  if(!viewer.id)throw new Error("Driver identity is unavailable.");
  if(viewer.role!=="driver")throw new Error("Only the authenticated Driver app can queue driver journey work.");
  return requireCachedSchoolContext(viewer.id,viewer.role);
}

export async function prepareDriverOfflineContext(){
  if(typeof navigator!=="undefined"&&!navigator.onLine)return;
  const context=await resolveActiveSchoolContext();
  if(context.role!=="driver")throw new Error("The selected school membership is not a Driver role.");
}

export async function progressTransportTripResilient(command:JourneyCommand,viewer:Viewer):Promise<{queued:boolean}>{
  if(typeof navigator==="undefined"||navigator.onLine){await progressTransportTrip(command);return{queued:false};}
  const context=viewerContext(viewer);
  await enqueueOffline({
    schoolId:context.schoolId,
    actorId:context.userId,
    role:context.role,
    entity:"transport_trip",
    command:JOURNEY_EVENT,
    payload:command,
    idempotencyKey:command.idempotencyKey,
  });
  return{queued:true};
}

export async function replayDriverOffline(viewer:Viewer){
  if(!viewer.id)return{synced:0,failed:0,tampered:0};
  const context=await resolveActiveSchoolContext();
  if(context.userId!==viewer.id||context.role!=="driver")throw new Error("Queued driver work belongs to a different active school or account.");
  return replayOffline({schoolId:context.schoolId,actorId:context.userId},{
    [JOURNEY_EVENT]:(payload)=>progressTransportTrip(payload as JourneyCommand),
  });
}
