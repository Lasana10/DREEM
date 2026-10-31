import type { CurriculumOutcomeSummary,TeachingAssignmentSummary } from "../domain/types";
export function resolveAssignedCurriculumFocus(
 assignments:TeachingAssignmentSummary[],
 outcomes:CurriculumOutcomeSummary[],
 viewerId:string|undefined,
 outcomeId:string|undefined
){
 if(!viewerId||!outcomeId)return undefined;
 const outcome=outcomes.find(x=>x.id===outcomeId&&x.status==="active");
 if(!outcome)return undefined;
 return assignments.find(a=>a.status==="active"&&a.teacherUserId===viewerId
  &&a.academicYearId===outcome.academicYearId
  &&a.classId===outcome.classId&&a.subjectId===outcome.subjectId);
}
