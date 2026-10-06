import type { LessonPlanCommand } from "../domain/types";
import { isSupabaseConfigured, supabase } from "./supabase";

export type CurriculumLessonPlanCommand=LessonPlanCommand&{outcomeIds:string[]};

export async function recordCurriculumLessonPlan(command:CurriculumLessonPlanCommand){
  if(!command.assignmentId)throw new Error("Choose a teaching assignment.");
  if(!command.lessonDate)throw new Error("Lesson date is required.");
  if(!command.title.trim())throw new Error("Lesson title is required.");
  if(!command.outcomeIds.length)throw new Error("Choose at least one curriculum outcome for this lesson.");
  if(command.objectives.trim().length<5)throw new Error("Confirm the learning objective for this lesson.");
  if(command.learningActivity.trim().length<5)throw new Error("Record the learner activity or teaching approach.");
  if(command.evidence.trim().length<3)throw new Error("Record what will show that learners understood the lesson.");
  if(!isSupabaseConfigured||!supabase)return{lessonPlanId:crypto.randomUUID(),status:"submitted"};
  const{data,error}=await supabase.rpc("dreem_record_lesson_plan_with_outcomes",{
    p_assignment_id:command.assignmentId,
    p_lesson_date:command.lessonDate,
    p_title:command.title.trim(),
    p_objectives:command.objectives.trim(),
    p_learning_activity:command.learningActivity.trim(),
    p_evidence:command.evidence.trim(),
    p_follow_up:command.followUp?.trim()||null,
    p_outcome_ids:command.outcomeIds,
    p_idempotency_key:command.idempotencyKey,
  });
  if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;
  if(!result)throw new Error("The lesson plan was not saved.");
  return{lessonPlanId:String(result.lesson_plan_id),status:String(result.lesson_plan_status)};
}
