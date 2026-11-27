// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup,render,screen} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {demoAcademics,demoAdmissions,demoBrand,demoFinance,demoLearners,demoSetup,demoSignals,demoStudentCases,demoTeachers,demoTransport} from "../domain/demo";
import type {WorkspaceData} from "../lib/repository";
import TeacherHome from "./TeacherHome";
afterEach(cleanup);
const workspace:WorkspaceData={
 viewer:{id:"teacher-unassigned",name:"Teacher Test",email:"teacher@example.test",role:"teacher"},
 brand:demoBrand,setup:demoSetup,operations:{invitations:[],memberships:[],recentAttendance:0,recentAssessments:0},
 learners:demoLearners,teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,admissions:demoAdmissions,academics:demoAcademics,transport:demoTransport,finance:demoFinance
};
describe("teacher first-day presentation",()=>{
 it("places today's actionable teacher priority above optional onboarding instructions",()=>{
  const {container}=render(<TeacherHome workspace={workspace} onNavigate={vi.fn()}/>);
  const task=container.querySelector(".teacher-intelligence-brief");
  const guide=screen.getByLabelText("Getting started with DREEM");
  expect(task).toBeInTheDocument();
  expect(guide).toBeInTheDocument();
  expect(task!.compareDocumentPosition(guide)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(task).toHaveTextContent("No class assigned to your account");
 });
});
