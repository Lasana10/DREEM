import type {AssignmentSummary, CurriculumOutcomeSummary, LearnerSummary, TeachingAssignmentSummary} from "../domain/types";

/** Preserve the actual class/subject/year context when a teacher prepares schoolwork. */
export function teachingAssignmentsForAuthor(assignments:TeachingAssignmentSummary[],userId:string,academicReviewer:boolean):TeachingAssignmentSummary[]{
 return assignments.filter(a=>a.status==="active"&&(academicReviewer||a.teacherUserId===userId));
}
export function curriculumForTeachingAssignment(outcomes:CurriculumOutcomeSummary[],assignment:TeachingAssignmentSummary|undefined):CurriculumOutcomeSummary[]{
 if(!assignment)return[];
 return outcomes.filter(o=>o.status==="active"&&o.academicYearId===assignment.academicYearId&&o.classId===assignment.classId&&o.subjectId===assignment.subjectId);
}
export function assignmentBelongsToLearner(assignment:AssignmentSummary,learner:LearnerSummary):boolean{
 return assignment.status==="published"&&assignment.className.trim().toLocaleLowerCase("en")===learner.className.trim().toLocaleLowerCase("en");
}
export function assignmentsForLinkedLearners(assignments:AssignmentSummary[],learners:LearnerSummary[]):AssignmentSummary[]{
 return assignments.filter(a=>learners.some(learner=>assignmentBelongsToLearner(a,learner)));
}
