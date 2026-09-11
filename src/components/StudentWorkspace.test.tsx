// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { demoAcademics,demoAdmissions,demoBrand,demoFinance,demoLearners,demoSetup,demoSignals,demoStudentCases,demoTeachers,demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import StudentWorkspace from "./StudentWorkspace";
const { submit } = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("../lib/repository", () => ({ submitAssignment: submit }));
const learner = demoLearners[0];
const assignment = { ...demoAcademics.assignmentsForLearners[0], id: "student-work", className: learner.className, status: "published" as const, submissionMode: "text" as const };
const base: WorkspaceData = { viewer: { id:"student-1",name:"Learner",email:"learner@example.test",role:"student" }, brand:demoBrand,setup:demoSetup,operations:{invitations:[],memberships:[],recentAttendance:0,recentAssessments:0},learners:[learner],teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,admissions:demoAdmissions,academics:{...demoAcademics,assignmentsForLearners:[assignment]},transport:demoTransport,finance:demoFinance };
afterEach(cleanup);
beforeEach(() => submit.mockReset().mockResolvedValue({ submissionId: "saved" }));
it("requires one linked learner instead of choosing an arbitrary record", () => {
  render(<StudentWorkspace workspace={{...base, learners:[learner,{...learner,id:"other"}]}} onRefresh={vi.fn()}/>);
  expect(screen.getByText("Learner access needs attention")).toBeInTheDocument();
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});
it("validates work and distinguishes a successful save from a failed refresh", async () => {
  render(<StudentWorkspace workspace={base} onRefresh={vi.fn().mockRejectedValue(new Error("Network"))}/>);
  fireEvent.click(screen.getByRole("button",{name:"Work"}));
  fireEvent.change(screen.getByLabelText("Assignment"),{target:{value:assignment.id}});
  fireEvent.click(screen.getByRole("button",{name:"Submit work"}));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Written response"),{target:{value:"My answer"}});
  fireEvent.click(screen.getByRole("button",{name:"Submit work"}));
  await waitFor(() => expect(submit).toHaveBeenCalledWith({assignmentId:assignment.id,studentId:learner.id,responseText:"My answer",file:undefined}));
  await screen.findByText(/Your work was saved, but the list could not refresh/);
  expect(screen.getByRole("status")).toHaveTextContent("Your work was saved by the school.");
});
