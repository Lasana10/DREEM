import type { CurriculumOutcomeSummary, LessonPlanSummary, TeachingAssignmentSummary } from "../domain/types";
import { resolveActiveSchoolContext } from "./schoolContext";
import { supabase } from "./supabase";
export type OutcomeLessonLink={lesson_plan_id:string;outcome_id:string};
export type OutcomeCoverage={
 outcome:CurriculumOutcomeSummary;
 plans:LessonPlanSummary[];
 reviewedPlans:number;pendingPlans:number;returnedPlans:number;
 state:"reviewed_evidence"|"pending_review"|"returned_only"|"not_recorded";
};
export async function loadOutcomeLessonLinks(plans:LessonPlanSummary[]):Promise<OutcomeLessonLink[]>{
 if(!plans.length)return [];
 if(!supabase)throw new Error("School connection unavailable.");
 await resolveActiveSchoolContext();
 const result:OutcomeLessonLink[]=[];
 // Bounded batches avoid PostgREST filter length and keep reads within existing RLS.
 for(let i=0;i<plans.length;i+=100){
  const ids=plans.slice(i,i+100).map(x=>x.id);
  const {data,error}=await supabase.from("dreem_lesson_plan_outcomes").select("lesson_plan_id,outcome_id").in("lesson_plan_id",ids).limit(1000);
  if(error)throw error;
  result.push(...((data??[]) as OutcomeLessonLink[]));
 }
 return result;
}
export function calculateOutcomeCoverage(
 outcomes:CurriculumOutcomeSummary[],assignments:TeachingAssignmentSummary[],
 plans:LessonPlanSummary[],links:OutcomeLessonLink[],
 viewerId?:string,teacherOnly=false
):OutcomeCoverage[]{
 const relevantAssignments=assignments.filter(a=>a.status==="active"&&(!teacherOnly||a.teacherUserId===viewerId));
 const keys=new Set(relevantAssignments.map(a=>[a.academicYearId,a.classId,a.subjectId].join(":")));
 const assignmentIds=new Set(relevantAssignments.map(a=>a.id));
 const byId=new Map(plans.filter(p=>assignmentIds.has(p.assignmentId)).map(p=>[p.id,p]));
 const byOutcome=new Map<string,LessonPlanSummary[]>();
 for(const link of links){
  const plan=byId.get(link.lesson_plan_id);
  if(!plan)continue;
  byOutcome.set(link.outcome_id,[...(byOutcome.get(link.outcome_id)??[]),plan]);
 }
 return outcomes.filter(o=>o.status==="active"&&keys.has([o.academicYearId,o.classId,o.subjectId].join(":"))).map(outcome=>{
  const items=byOutcome.get(outcome.id)??[];
  const reviewedPlans=items.filter(p=>p.status==="reviewed").length;
  const pendingPlans=items.filter(p=>p.status==="submitted").length;
  const returnedPlans=items.filter(p=>p.status==="returned").length;
  const state=reviewedPlans?"reviewed_evidence":pendingPlans?"pending_review":returnedPlans?"returned_only":"not_recorded";
  return{outcome,plans:items,reviewedPlans,pendingPlans,returnedPlans,state};
 });
}
