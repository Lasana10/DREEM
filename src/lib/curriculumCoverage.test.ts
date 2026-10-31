import { describe,expect,it } from "vitest";
import { calculateOutcomeCoverage } from "./curriculumCoverage";
import type { TeachingAssignmentSummary,CurriculumOutcomeSummary,LessonPlanSummary } from "../domain/types";
const assign=(id:string,teacherUserId:string):TeachingAssignmentSummary=>({
 id,academicYearId:"year",termId:"term",classId:"class",className:"Class 4",
 subjectId:"subject",subjectName:"Math",teacherUserId,teacherName:"Teacher",weeklyPeriods:4,status:"active"
});
const outcome=(id:string):CurriculumOutcomeSummary=>({
 id,academicYearId:"year",classId:"class",subjectId:"subject",code:id,titleEn:"Understand fractions",
 source:"school",status:"active"
});
const plan=(id:string,assignmentId:string,status:LessonPlanSummary["status"]):LessonPlanSummary=>({
 id,assignmentId,className:"Class 4",subjectName:"Math",lessonDate:"2026-10-26",
 title:"Fractions",objectives:"Recognise fractions",learningActivity:"Practice",evidence:"Worksheet",
 status,createdBy:"teacher"
});
describe("curriculum coverage evidence",()=>{
 it("does not infer curriculum completion from an unlinked lesson",()=>{
  const result=calculateOutcomeCoverage([outcome("a")],[assign("x","teacher")],[plan("p","x","reviewed")],[],undefined,false);
  expect(result[0].state).toBe("not_recorded");
 });
 it("distinguishes independent plan review from pending and returned work",()=>{
  const plans=[plan("p1","x","submitted"),plan("p2","x","returned"),plan("p3","x","reviewed")];
  const links=[{lesson_plan_id:"p1",outcome_id:"a"},{lesson_plan_id:"p2",outcome_id:"b"},{lesson_plan_id:"p3",outcome_id:"c"}];
  const states=calculateOutcomeCoverage([outcome("a"),outcome("b"),outcome("c")],[assign("x","teacher")],plans,links).map(x=>x.state);
  expect(states).toEqual(["pending_review","returned_only","reviewed_evidence"]);
 });
 it("prevents unrelated teacher assignments from appearing in personal coverage",()=>{
  expect(calculateOutcomeCoverage([outcome("a")],[assign("x","another")],[],[],"teacher",true)).toEqual([]);
 });
});
