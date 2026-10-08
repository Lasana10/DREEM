import { describe, expect, it } from "vitest";
import { buildInstitutionFlowHealth, evaluateRecommendedPolicies } from "./operationalExcellence";
import type { AcademicOperations, FinanceSummary, LearnerSummary, TransportOperations } from "./types";

const learner:LearnerSummary={id:"l1",matricule:"DRM-1",name:"Ada N.",className:"Class 5",mastery:54,attendance:74,engagement:70,wellbeing:80,trend:-3,nextAction:"Review",idStatus:"active",feeAccountId:"fa1",feeBalance:50000};
const academics:AcademicOperations={
 assignments:[],timetable:[],lessonPlans:[],curriculumOutcomes:[],
 curriculumProposals:[],curriculumProvenance:[],curriculumFeedback:[],
 assignmentsForLearners:[
  {id:"a1",teachingAssignmentId:"ta1",termId:"t1",classId:"c1",className:"Class 5",subjectId:"s1",subjectName:"Mathematics",title:"Fractions",instructions:"",assignedOn:"2026-09-01",dueAt:"2026-09-10T12:00:00.000Z",maxScore:20,submissionMode:"text",status:"published",createdBy:"teacher"},
  {id:"a2",teachingAssignmentId:"ta1",termId:"t1",classId:"c1",className:"Class 5",subjectId:"s1",subjectName:"Mathematics",title:"Decimals",instructions:"",assignedOn:"2026-09-02",dueAt:"2026-09-11T12:00:00.000Z",maxScore:20,submissionMode:"text",status:"published",createdBy:"teacher"},
 ],assignmentSubmissions:[],assessments:[],reportCards:[],documents:[]
};
const finance:FinanceSummary={expectedToday:100000,collectedToday:50000,reconciledToday:0,openExceptions:1,openExceptionValue:5000,nextDeposit:0,cashCollected:50000,cashAwaitingDeposit:50000,digitalConfirmed:0,parentConfirmationsPending:1};
const transport:TransportOperations={routes:[],vehicles:[],drivers:[],assignments:[{id:"tr1",studentId:"l1",studentName:"Ada N.",routeId:"r1",routeName:"Route A",pickupStopId:"p1",pickupStopName:"Mendong",dropoffStopId:"p2",dropoffStopName:"School",status:"active"}],trips:[{id:"trip1",routeId:"r1",routeName:"Route A",vehicleId:"v1",vehicleCode:"BUS1",driverId:"d1",driverName:"Driver",serviceDate:"2026-09-28",direction:"inbound",status:"delayed",assignedStudents:1}]};

describe("DREEM operational excellence",()=>{
 it("combines learner, learning, finance and transport evidence into follow-up",()=>{
  const actions=evaluateRecommendedPolicies({learners:[learner],academics,finance,transport,admissions:[],signals:[],cases:[]},undefined,new Date("2026-09-28T12:00:00Z"));
  expect(actions.some(x=>x.id==="learner-combined:l1")).toBe(true);
  expect(actions.some(x=>x.id==="missing-work:l1")).toBe(true);
  expect(actions.some(x=>x.id==="finance-difference")).toBe(true);
  expect(actions.some(x=>x.id==="finance-cash")).toBe(true);
  expect(actions.some(x=>x.id==="transport-delay")).toBe(true);
  expect(actions.every(x=>x.automaticAction==="none"||x.automaticAction==="notify_only")).toBe(true);
 });
 it("keeps a healthy admission → learner → transport hand-off green",()=>{
  const flow=buildInstitutionFlowHealth({
   learners:[learner],academics,finance,transport,
   admissions:[{id:"app1",applicationNumber:"A1",learnerName:"Ada N.",targetClassName:"Class 5",guardianName:"Parent",status:"enrolled",source:"school_desk",enrolledStudentId:"l1",submittedAt:"2026-09-01",updatedAt:"2026-09-02"}],
   signals:[],cases:[],
  });
  expect(flow.some(x=>x.status==="broken")).toBe(false);
  expect(flow.some(x=>x.id==="core-links-healthy")).toBe(true);
 });
 it("detects a broken cross-domain learner reference",()=>{
  const flow=buildInstitutionFlowHealth({
   learners:[learner],academics,finance,
   transport:{...transport,assignments:[{...transport.assignments[0],studentId:"missing"}]},
   admissions:[{id:"app1",applicationNumber:"A1",learnerName:"Missing",targetClassName:"Class 5",guardianName:"Parent",status:"enrolled",source:"school_desk",enrolledStudentId:"missing",submittedAt:"2026-09-01",updatedAt:"2026-09-02"}],
   signals:[],cases:[],
  });
  expect(flow.filter(x=>x.status==="broken").map(x=>x.id)).toEqual(expect.arrayContaining(["admission-learner-link","transport-learner-link"]));
 });
});
it("detects an enrolled learner whose finance hand-off is missing",()=>{
  const flow=buildInstitutionFlowHealth({
    learners:[{...learner,feeAccountId:undefined}],academics,finance,transport:{...transport,assignments:[]},
    admissions:[{id:"app2",applicationNumber:"A2",learnerName:"Ada N.",targetClassName:"Class 5",guardianName:"Parent",status:"enrolled",source:"school_desk",enrolledStudentId:"l1",submittedAt:"2026-09-01",updatedAt:"2026-09-02"}],
    signals:[],cases:[],
  });
  expect(flow.some(x=>x.id==="enrolment-finance-link"&&x.status==="broken")).toBe(true);
});

it("handles a large school evidence set deterministically",()=>{
  const learners=Array.from({length:2500},(_,index)=>({...learner,id:"l"+index,name:"Learner "+index,attendance:index%5===0?70:95,mastery:index%7===0?50:82}));
  const actions=evaluateRecommendedPolicies({learners,academics:{...academics,assignmentsForLearners:[],assignmentSubmissions:[]},finance:{...finance,openExceptions:0,openExceptionValue:0,cashAwaitingDeposit:0},transport:{...transport,trips:[],assignments:[]},admissions:[],signals:[],cases:[]});
  expect(actions.length).toBeGreaterThan(0);
  expect(actions.filter(item=>item.area==="learner"||item.area==="learning").length).toBeGreaterThan(500);
  expect(new Set(actions.map(item=>item.id)).size).toBe(actions.length);
});
