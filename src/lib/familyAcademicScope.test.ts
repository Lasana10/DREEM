import {describe,expect,it} from "vitest";
import {demoSetup,demoLearners} from "../domain/demo";
import type {AssignmentSummary,ReportCardSummary} from "../domain/types";
import {familyAcademicScope,publishedFamilyHomework,publishedFamilyReports,familyFeeBalanceLabel} from "./familyAcademicScope";
const child={...demoLearners[0],id:"pupil-1",className:"Form 4A"};
const lesson=(id:string,classId:string,termId:string,status:AssignmentSummary["status"]="published"):AssignmentSummary=>({
 id,teachingAssignmentId:"teacher",termId,classId,className:"Form 4A",subjectId:"math",subjectName:"Mathematics",title:id,
 instructions:"",assignedOn:"2026-11-27",dueAt:"2026-12-01T08:00:00Z",maxScore:20,submissionMode:"text",status,createdBy:"teacher",
});
const report=(id:string,termId:string,status:ReportCardSummary["status"]="published"):ReportCardSummary=>({
 id,studentId:"pupil-1",studentName:"Pupil",termId,termName:"Term",status,revision:1,evidenceCount:3,generatedBy:"teacher",generatedAt:"2026-11-26"
});
describe("private active-year family academic view",()=>{
 it("shows only current class published homework and current term report cards",()=>{
  const homework=[lesson("correct","class-1","term-1"),lesson("other-year","class-1","obsolete"),lesson("other-class","class-2","term-1"),lesson("draft","class-1","term-1","draft")];
  expect(publishedFamilyHomework(demoSetup,child,homework).map(x=>x.id)).toEqual(["correct"]);
  expect(publishedFamilyReports(demoSetup,child,[report("current","term-1"),report("historical","old"),report("draft","term-1","draft")]).map(x=>x.id)).toEqual(["current"]);
 });
 it("does not leak published work into planning years or ambiguous class matches",()=>{
  const planned={...demoSetup,academicYears:demoSetup.academicYears.map(y=>({...y,status:"planning" as const}))};
  expect(publishedFamilyHomework(planned,child,[lesson("published","class-1","term-1")])).toEqual([]);
  const duplicated={...demoSetup,classes:[...demoSetup.classes,{...demoSetup.classes[0],id:"duplicate"}]};
  expect(familyAcademicScope(duplicated,child).ready).toBe(false);
 });
 it("does not invent a zero school-fee balance when it is absent",()=>{
  expect(familyFeeBalanceLabel(undefined)).toBe(null);
  expect(familyFeeBalanceLabel(Number.NaN)).toBe(null);
  expect(familyFeeBalanceLabel(0)).toContain("FCFA");
 });
});
