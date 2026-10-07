import type { AttendanceCommand, Role } from "../domain/types";
import { recordCurriculumLessonPlan, type CurriculumLessonPlanCommand } from "./curriculumLessonPlans";
import { enqueueOffline, isRetryableRemoteFailure, replayOffline, type OfflineOperation } from "./offlineOutbox";
import { recordAttendance } from "./repository";
import { requireCachedSchoolContext, resolveActiveSchoolContext } from "./schoolContext";
import { isSupabaseConfigured, supabase } from "./supabase";

type Viewer={id?:string;role:Role};
export type ResilientWriteResult={queued:boolean};

const ATTENDANCE="teacher.record_attendance";
const LESSON_PLAN="teacher.record_lesson_plan";

function viewerContext(viewer:Viewer){
  if(!viewer.id)throw new Error("Teacher identity is unavailable.");
  return requireCachedSchoolContext(viewer.id,viewer.role);
}

export async function prepareTeacherOfflineContext(){
  if(typeof navigator!=="undefined"&&!navigator.onLine)return;
  await resolveActiveSchoolContext();
}

export async function recordAttendanceResilient(command:AttendanceCommand,viewer:Viewer):Promise<ResilientWriteResult>{
  const context=viewerContext(viewer);
  if(typeof navigator==="undefined"||navigator.onLine){
    try{await recordAttendance(command);return{queued:false};}
    catch(reason){if(!isRetryableRemoteFailure(reason))throw reason;}
  }
  await enqueueOffline({schoolId:context.schoolId,actorId:context.userId,role:context.role,entity:"attendance",command:ATTENDANCE,payload:command,idempotencyKey:command.idempotencyKey});
  return{queued:true};
}

export async function recordLessonPlanResilient(command:CurriculumLessonPlanCommand,viewer:Viewer):Promise<ResilientWriteResult>{
  const context=viewerContext(viewer);
  if(typeof navigator==="undefined"||navigator.onLine){
    try{await recordCurriculumLessonPlan(command);return{queued:false};}
    catch(reason){if(!isRetryableRemoteFailure(reason))throw reason;}
  }
  await enqueueOffline({schoolId:context.schoolId,actorId:context.userId,role:context.role,entity:"lesson_plan",command:LESSON_PLAN,payload:command,idempotencyKey:command.idempotencyKey});
  return{queued:true};
}

async function ingestTeacherOperation(payload:unknown,operation:OfflineOperation){
  if(!isSupabaseConfigured||!supabase)throw new Error("DREEM is not connected to the school server.");
  const{data,error}=await supabase.rpc("dreem_ingest_teacher_offline_operation",{
    p_operation_id:operation.id,p_school_id:operation.schoolId,p_device_id:operation.deviceId,p_command:operation.command,
    p_payload:payload,p_payload_digest:operation.payloadDigest,p_captured_at:operation.createdAt,p_idempotency_key:operation.idempotencyKey,
  });
  if(error)throw error;
  const result=(data??{}) as {accepted?:boolean;duplicate?:boolean;error?:string};
  if(result.accepted!==true)throw new Error(result.error||"The school server rejected this offline action after rechecking current authority.");
  return result;
}

export async function replayTeacherOffline(viewer:Viewer){
  if(!viewer.id)return{synced:0,failed:0,tampered:0,receipts:[]};
  const context=await resolveActiveSchoolContext();
  if(context.userId!==viewer.id)throw new Error("Offline teacher work belongs to a different signed-in account.");
  return replayOffline({schoolId:context.schoolId,actorId:context.userId},{
    [ATTENDANCE]:ingestTeacherOperation,
    [LESSON_PLAN]:ingestTeacherOperation,
  });
}
