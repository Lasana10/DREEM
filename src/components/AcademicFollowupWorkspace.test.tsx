// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {WorkspaceData} from "../lib/repository";
import type {WeeklyRegister} from "../lib/weeklyRegisters";
import AcademicFollowupWorkspace from "./AcademicFollowupWorkspace";

const api=vi.hoisted(()=>({list:vi.fn(),open:vi.fn(),respond:vi.fn(),review:vi.fn(),checks:vi.fn()}));
vi.mock("../lib/academicFollowups",()=>({
 listAcademicFollowups:api.list,openAcademicFollowup:api.open,
 respondAcademicFollowup:api.respond,reviewAcademicFollowup:api.review
}));
vi.mock("../lib/weeklyRegisters",()=>({listMarkingChecks:api.checks}));
const register:WeeklyRegister={
 id:"r1",school_id:"s1",teaching_assignment_id:"a1",week_start:"2026-10-26",
 lessons_delivered:4,exercises_assigned:3,marking_state:"completed",
 curriculum_progress:"Fractions",learner_difficulties:"",evidence_reference:"",
 teacher_note:"",status:"approved",submitted_by:"teacher",submitted_at:"2026-10-26T13:00:00Z",
 reviewed_at:null,review_note:null
};
const followup={
 id:"f1",school_id:"s1",register_id:"r1",marking_check_id:null,
 assigned_teacher:"teacher",title:"Recheck mathematics exercises",
 required_action:"Correct the identified marking omissions",due_date:"2026-11-10",
 status:"open" as const,created_by:"head",created_at:"2026-10-30T12:00:00Z",
 response:null,response_evidence:null,responded_at:null,review_note:null,
 reviewed_by:null,reviewed_at:null,closed_at:null
};
const workspace=(id:string)=>({
 viewer:{id},academics:{assignments:[{id:"a1",className:"Class 4",teacherName:"Teacher A"}]}
}) as unknown as WorkspaceData;
describe("academic corrective action workflow",()=>{
 beforeEach(()=>{api.list.mockResolvedValue([followup]);api.checks.mockResolvedValue([]);api.respond.mockResolvedValue(undefined);api.review.mockResolvedValue(undefined);});
 afterEach(()=>{cleanup();vi.clearAllMocks();});
 it("allows assigned teacher to submit evidence, not leadership-only verification",async()=>{
  render(<AcademicFollowupWorkspace workspace={workspace("teacher")} registers={[register]} reviewer={false}/>);
  expect(await screen.findByText("Recheck mathematics exercises")).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Describe your actual corrective work"),{target:{value:"I corrected and rechecked all pages."}});
  fireEvent.change(screen.getByPlaceholderText("Exercise book pages, lesson evidence or document reference"),{target:{value:"Book 12 p. 14"}});
  fireEvent.click(screen.getByRole("button",{name:"Submit evidence for review"}));
  await waitFor(()=>expect(api.respond).toHaveBeenCalledWith("f1","I corrected and rechecked all pages.","Book 12 p. 14"));
  expect(api.review).not.toHaveBeenCalled();
 });
 it("does not present teacher response controls to a leadership reviewer",async()=>{
  render(<AcademicFollowupWorkspace workspace={workspace("head")} registers={[register]} reviewer={true}/>);
  expect(await screen.findByText("Recheck mathematics exercises")).toBeInTheDocument();
  expect(screen.queryByRole("button",{name:"Submit evidence for review"})).not.toBeInTheDocument();
 });
});
