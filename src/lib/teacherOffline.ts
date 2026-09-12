import type { AttendanceCommand, Role } from "../domain/types";
import { enqueueOffline, replayOffline } from "./offlineOutbox";
import { recordAttendance, recordLessonPlan } from "./repository";
import { requireCachedSchoolContext, resolveActiveSchoolContext } from "./schoolContext";

type LessonPlanCommand=Parameters<typeof recordLessonPlan>[0];
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
  if(typeof navigator==="undefined"||navigator.onLine){await recordAttendance(command);return{queued:false};}
  const context=viewerContext(viewer);
  await enqueueOffline({schoolId:context.schoolId,actorId:context.userId,role:context.role,entity:"attendance",command:ATTENDANCE,payload:command,idempotencyKey:command.idempotencyKey});
  return{queued:true};
}

export async function recordLessonPlanResilient(command:LessonPlanCommand,viewer:Viewer):Promise<ResilientWriteResult>{
  if(typeof navigator==="undefined"||navigator.onLine){await recordLessonPlan(command);return{queued:false};}
  const context=viewerContext(viewer);
  await enqueueOffline({schoolId:context.schoolId,actorId:context.userId,role:context.role,entity:"lesson_plan",command:LESSON_PLAN,payload:command,idempotencyKey:command.idempotencyKey});
  return{queued:true};
}

export async function replayTeacherOffline(viewer:Viewer){
  if(!viewer.id)return{synced:0,failed:0,tampered:0};
  const context=await resolveActiveSchoolContext();
  if(context.userId!==viewer.id)throw new Error("Offline teacher work belongs to a different signed-in account.");
  return replayOffline({schoolId:context.schoolId,actorId:context.userId},{
    [ATTENDANCE]:(payload)=>recordAttendance(payload as AttendanceCommand),
    [LESSON_PLAN]:(payload)=>recordLessonPlan(payload as LessonPlanCommand),
  });
}
