import {describe,expect,it} from "vitest";
import {assignmentBelongsToLearner,assignmentsForLinkedLearners,curriculumForTeachingAssignment,teachingAssignmentsForAuthor} from "./learningContext";
import type {AssignmentSummary,CurriculumOutcomeSummary,LearnerSummary,TeachingAssignmentSummary} from "../domain/types";
const teaching=(id:string,teacherUserId:string,status:TeachingAssignmentSummary["status"]="active"):TeachingAssignmentSummary=>({id,academicYearId:"y",termId:"t",classId:id,className:id,subjectId:"math",subjectName:"Mathematics",teacherUserId,teacherName:"Teacher",weeklyPeriods:5,status});
const questionOutcome=(id:string,classId:string,subjectId:string,academicYearId:string,status:CurriculumOutcomeSummary["status"]="active"):CurriculumOutcomeSummary=>({id,classId,subjectId,academicYearId,code:id,titleEn:id,source:"school",status});
const learner=(id:string,className:string):LearnerSummary=>({id,matricule:id,name:id,className,mastery:0,attendance:0,engagement:0,wellbeing:0,trend:0,nextAction:"",idStatus:"active"});
const assignment=(id:string,className:string,status:AssignmentSummary["status"]="published"):AssignmentSummary=>({id,teachingAssignmentId:"a",termId:"t",classId:id,className,subjectId:"math",subjectName:"Math",title:id,instructions:"",assignedOn:"2026-11-26",dueAt:"2026-11-27T08:00:00Z",maxScore:20,submissionMode:"text",status,createdBy:"teacher"});

describe("teacher and family schoolwork context",()=>{
 it("shows only a teacher's active allocations unless independently authorised",()=>{
  const assignments=[teaching("class-a","teacher-a"),teaching("class-b","teacher-b"),teaching("closed","teacher-a","completed")];
  expect(teachingAssignmentsForAuthor(assignments,"teacher-a",false).map(a=>a.id)).toEqual(["class-a"]);
  expect(teachingAssignmentsForAuthor(assignments,"head",true).map(a=>a.id)).toEqual(["class-a","class-b"]);
 });
 it("limits objective selection to assigned class, subject and year",()=>{
  const outcomes=[questionOutcome("ok","class-a","math","y"),questionOutcome("other-class","class-b","math","y"),questionOutcome("other-subject","class-a","english","y"),questionOutcome("other-year","class-a","math","other"),questionOutcome("retired","class-a","math","y","retired")];
  expect(curriculumForTeachingAssignment(outcomes,teaching("class-a","teacher-a")).map(o=>o.id)).toEqual(["ok"]);
  expect(curriculumForTeachingAssignment(outcomes,undefined)).toEqual([]);
 });
 it("matches published work only to linked children in the right class",()=>{
  const entries=[assignment("m4","Primary 4"),assignment("m5","Primary 5"),assignment("draft","Primary 4","draft")];
  expect(assignmentsForLinkedLearners(entries,[learner("child","primary 4")]).map(a=>a.id)).toEqual(["m4"]);
  expect(assignmentBelongsToLearner(entries[1],learner("child","Primary 4"))).toBe(false);
  expect(assignmentsForLinkedLearners(entries,[learner("child","Primary 4"),learner("sibling","Primary 5")]).map(a=>a.id)).toEqual(["m4","m5"]);
 });
});
