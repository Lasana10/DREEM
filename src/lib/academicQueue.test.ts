import { describe,expect,it } from "vitest";
import { buildAcademicQueue,type AcademicQueueSource } from "./academicQueue";
const empty=():AcademicQueueSource=>({lessonPlans:[],assessments:[],questions:[],papers:[],registers:[],checks:[],viewerId:"head"});
describe("academic action queue",()=>{
 it("routes teacher responses and overdue academic improvements to independent review",()=>{
  const data=empty();data.today="2026-11-01";data.followups=[
   {id:"f1",status:"responded",title:"Correct marking",due_date:"2026-11-05",assigned_teacher:"teacher"},
   {id:"f2",status:"open",title:"Supply lesson evidence",due_date:"2026-10-20",assigned_teacher:"teacher"},
   {id:"f3",status:"closed",title:"Already completed",due_date:"2026-10-20",assigned_teacher:"teacher"}
  ];
  expect(buildAcademicQueue(data).filter(x=>x.kind==="followup").map(x=>x.id)).toEqual(["f1","f2"]);
 });
 it("excludes decisions owned by the current reviewer",()=>{
  const data=empty();data.questions=[{id:"q1",created_by:"head",question_text:"Question",status:"submitted"},{id:"q2",created_by:"teacher",question_text:"Question 2",status:"submitted"}];
  expect(buildAcademicQueue(data).map(x=>x.id)).toEqual(["q2"]);
 });
 it("requires explicit independent marking verification",()=>{
  const data=empty();data.registers=[{id:"r1",submitted_by:"teacher",status:"approved",marking_state:"completed",week_start:"2026-10-26",teaching_assignment_id:"a"}];
  expect(buildAcademicQueue(data).map(x=>x.kind)).toEqual(["marking_check"]);
  data.checks=[{register_id:"r1",decision:"inconclusive"}];
  expect(buildAcademicQueue(data)).toEqual([]);
 });
 it("routes teacher submissions to academic workflows",()=>{
  const data=empty();data.papers=[{id:"p1",created_by:"teacher",title:"Term test",revision:1,status:"submitted"}];
  data.registers=[{id:"r1",submitted_by:"teacher",status:"submitted",marking_state:"pending",week_start:"2026-10-26",teaching_assignment_id:"a"}];
  expect(buildAcademicQueue(data).map(x=>x.area)).toEqual(["questions","weekly"]);
 });
});
