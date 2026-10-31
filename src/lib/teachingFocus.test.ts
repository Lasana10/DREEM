import {describe,expect,it} from "vitest";
import type {CurriculumOutcomeSummary,TeachingAssignmentSummary} from "../domain/types";
import {resolveAssignedCurriculumFocus} from "./teachingFocus";
const assignment=(id:string,teacher:string,year="year"):TeachingAssignmentSummary=>({
 id,academicYearId:year,termId:"term",classId:"class",className:"Class 3",
 subjectId:"math",subjectName:"Mathematics",teacherUserId:teacher,teacherName:"Teacher",
 weeklyPeriods:4,status:"active"
});
const outcome=(id:string,year="year"):CurriculumOutcomeSummary=>({
 id,academicYearId:year,classId:"class",subjectId:"math",code:id,titleEn:"Add fractions",
 source:"national",status:"active"
});
describe("curriculum-to-classroom handoff",()=>{
 it("opens the matching assignment for the authenticated teacher",()=>{
  expect(resolveAssignedCurriculumFocus([assignment("a","teacher")],[outcome("one")],"teacher","one")?.id).toBe("a");
 });
 it("does not expose another teacher's class",()=>{
  expect(resolveAssignedCurriculumFocus([assignment("a","other")],[outcome("one")],"teacher","one")).toBeUndefined();
 });
 it("rejects a stale academic year and inactive outcomes",()=>{
  expect(resolveAssignedCurriculumFocus([assignment("a","teacher","past")],[outcome("one")],"teacher","one")).toBeUndefined();
  expect(resolveAssignedCurriculumFocus([assignment("a","teacher")],[{...outcome("one"),status:"retired"}],"teacher","one")).toBeUndefined();
 });
 it("does not infer a teacher from an absent viewer identity",()=>{
  expect(resolveAssignedCurriculumFocus([assignment("a","teacher")],[outcome("one")],undefined,"one")).toBeUndefined();
 });
});
