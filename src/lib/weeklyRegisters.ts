import { resolveActiveSchoolContext } from "./schoolContext";
import { supabase } from "./supabase";

export type WeeklyRegister = {
  id:string; school_id:string; teaching_assignment_id:string; week_start:string;
  lessons_delivered:number; exercises_assigned:number; marking_state:"not_applicable"|"pending"|"partial"|"completed";
  curriculum_progress:string; learner_difficulties:string; evidence_reference:string; teacher_note:string;
  status:"submitted"|"approved"|"returned"; submitted_by:string; submitted_at:string;
  reviewed_at:string|null; review_note:string|null;
};
export type WeeklyRegisterInput={
 assignmentId:string;weekStart:string;lessonsDelivered:number;exercisesAssigned:number;
 markingState:WeeklyRegister["marking_state"];curriculumProgress:string;
 learnerDifficulties:string;evidenceReference:string;teacherNote:string;
};
export async function listWeeklyRegisters(weekStart:string):Promise<WeeklyRegister[]>{
 if(!supabase)throw new Error("School service unavailable.");
 const ctx=await resolveActiveSchoolContext();
 const {data,error}=await supabase.from("dreem_weekly_teaching_registers")
 .select("id,school_id,teaching_assignment_id,week_start,lessons_delivered,exercises_assigned,marking_state,curriculum_progress,learner_difficulties,evidence_reference,teacher_note,status,submitted_by,submitted_at,reviewed_at,review_note")
 .eq("school_id",ctx.schoolId).eq("week_start",weekStart).limit(200);
 if(error)throw error;
 return (data??[]) as WeeklyRegister[];
}
export async function submitWeeklyRegister(input:WeeklyRegisterInput){
 if(!supabase)throw new Error("School service unavailable.");
 const {data,error}=await supabase.rpc("dreem_submit_weekly_register",{
 p_assignment_id:input.assignmentId,p_week_start:input.weekStart,
 p_lessons_delivered:input.lessonsDelivered,p_exercises_assigned:input.exercisesAssigned,
 p_marking_state:input.markingState,p_curriculum_progress:input.curriculumProgress,
 p_learner_difficulties:input.learnerDifficulties,p_evidence_reference:input.evidenceReference,
 p_teacher_note:input.teacherNote
 });
 if(error)throw error;
 return data as string;
}
export async function reviewWeeklyRegister(id:string,decision:"approved"|"returned",note:string){
 if(!supabase)throw new Error("School service unavailable.");
 const {data,error}=await supabase.rpc("dreem_review_weekly_register",{
 p_register_id:id,p_decision:decision,p_note:note
 });
 if(error)throw error;
 return data as string;
}

export type MarkingCheck={id:string;school_id:string;register_id:string;sampled_books:number;decision:"verified"|"needs_correction"|"inconclusive";evidence_reference:string;findings:string;checked_by:string;checked_at:string};
export async function listMarkingChecks(registerIds:string[]):Promise<MarkingCheck[]>{
 if(!supabase)throw new Error("School service unavailable.");
 if(registerIds.length===0)return [];
 const school=await resolveActiveSchoolContext();
 const {data,error}=await supabase.from("dreem_weekly_marking_checks")
 .select("id,school_id,register_id,sampled_books,decision,evidence_reference,findings,checked_by,checked_at")
 .eq("school_id",school.schoolId).in("register_id",registerIds.slice(0,200))
 .order("checked_at",{ascending:false}).limit(200);
 if(error)throw error;
 return(data??[]) as MarkingCheck[];
}
export async function recordMarkingCheck(input:{registerId:string;sampledBooks:number;decision:MarkingCheck["decision"];reference:string;findings:string}):Promise<string>{
 if(!supabase)throw new Error("School service unavailable.");
 const {data,error}=await supabase.rpc("dreem_record_marking_check",{
  p_register_id:input.registerId,p_sampled_books:input.sampledBooks,
  p_decision:input.decision,p_evidence_reference:input.reference,p_findings:input.findings
 });
 if(error)throw error;
 return String(data);
}
