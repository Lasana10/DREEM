import type { LessonPlanSummary, AssessmentSummary } from "../domain/types";
import type { QuestionItem } from "./questionBank";
import type { SavedExamPaper } from "./examPapers";
import type { WeeklyRegister, MarkingCheck } from "./weeklyRegisters";
import type { AcademicFollowup } from "./academicFollowups";

export type AcademicQueueArea="review"|"questions"|"weekly";
export type AcademicQueueItem={
 id:string;area:AcademicQueueArea;kind:"lesson"|"assessment"|"question"|"paper"|"weekly_register"|"marking_check"|"followup";
 title:string;detail:string;submittedAt?:string;
};
export type AcademicQueueSource={
 lessonPlans:LessonPlanSummary[];assessments:AssessmentSummary[];
 questions:Pick<QuestionItem,"id"|"status"|"question_text"|"created_by">[];
 papers:Pick<SavedExamPaper,"id"|"status"|"title"|"revision"|"created_by">[];
 registers:Pick<WeeklyRegister,"id"|"status"|"week_start"|"marking_state"|"submitted_by"|"teaching_assignment_id">[];
 checks:Pick<MarkingCheck,"register_id"|"decision">[];
 followups?:Pick<AcademicFollowup,"id"|"status"|"title"|"due_date"|"assigned_teacher">[];
 today?:string;
 viewerId?:string;
};
export function buildAcademicQueue(source:AcademicQueueSource):AcademicQueueItem[]{
 const items:AcademicQueueItem[]=[];
 for(const lesson of source.lessonPlans){
  if(lesson.status==="submitted"&&lesson.createdBy!==source.viewerId)items.push({
   id:lesson.id,area:"review",kind:"lesson",title:lesson.title,
   detail:`${lesson.className} · ${lesson.subjectName} · ${lesson.lessonDate}`
  });
 }
 for(const assessment of source.assessments){
  if(assessment.status==="submitted"&&assessment.createdBy!==source.viewerId)items.push({
   id:assessment.id,area:"review",kind:"assessment",title:assessment.title,
   detail:`${assessment.className} · ${assessment.subjectName} · ${assessment.marksCount} marks recorded`
  });
 }
 for(const question of source.questions){
  if(question.status==="submitted"&&question.created_by!==source.viewerId)items.push({
   id:question.id,area:"questions",kind:"question",title:question.question_text,
   detail:"Awaiting independent question moderation"
  });
 }
 for(const paper of source.papers){
  if(paper.status==="submitted"&&paper.created_by!==source.viewerId)items.push({
   id:paper.id,area:"questions",kind:"paper",title:paper.title,
   detail:`Examination paper · revision ${paper.revision}`
  });
 }
 const latestChecks=new Map<string,Pick<MarkingCheck,"register_id"|"decision">>();
 for(const check of source.checks){if(!latestChecks.has(check.register_id))latestChecks.set(check.register_id,check);}
 for(const register of source.registers){
  if(register.submitted_by===source.viewerId)continue;
  if(register.status==="submitted")items.push({
   id:register.id,area:"weekly",kind:"weekly_register",title:`Teaching week ${register.week_start}`,
   detail:"Weekly submission awaiting leadership decision"
  });
  if(register.marking_state==="completed"&&!latestChecks.has(register.id))items.push({
   id:register.id+":marking",area:"weekly",kind:"marking_check",title:`Marking evidence · ${register.week_start}`,
   detail:"Teacher reports marking complete; no sampled check recorded"
  });
 }
 for(const followup of source.followups??[]){
  const needsReview=followup.status==="responded";
  const overdue=followup.status!=="closed"&&followup.due_date<(source.today??"");
  if(!needsReview&&!overdue)continue;
  items.push({id:followup.id,area:"weekly",kind:"followup",title:followup.title,
   detail:needsReview?"Teacher corrective evidence awaiting verification":`Overdue teaching improvement · due ${followup.due_date}`});
 }
 return items;
}
