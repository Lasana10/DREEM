// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAcademics, demoAdmissions, demoBrand, demoFinance, demoLearners, demoSetup, demoSignals, demoStudentCases, demoTeachers, demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import ClassroomWorkspace from "./ClassroomWorkspace";

const recordAttendance=vi.fn(),recordAssessment=vi.fn();
vi.mock("../lib/repository",async()=>{const actual=await vi.importActual<typeof import("../lib/repository")>("../lib/repository");return{...actual,recordAttendance:(input:unknown)=>recordAttendance(input),recordAssessment:(input:unknown)=>recordAssessment(input)}});
const workspace:WorkspaceData={viewer:{id:"t1",name:"Demo Teacher A",email:"teacher@example.test",role:"teacher"},brand:demoBrand,setup:demoSetup,operations:{invitations:[],memberships:[],recentAttendance:0,recentAssessments:0},learners:demoLearners,teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,admissions:demoAdmissions,academics:demoAcademics,transport:demoTransport,finance:demoFinance};
describe("teacher classroom workspace",()=>{afterEach(()=>{cleanup();vi.clearAllMocks()});it("shows only assigned classroom operations",()=>{render(<ClassroomWorkspace workspace={workspace} onRefresh={async()=>undefined}/>);expect(screen.getByRole("heading",{name:/today's teaching/i})).toBeInTheDocument();expect(screen.getByText("Mathematics")).toBeInTheDocument();expect(screen.queryByText("Invite staff")).not.toBeInTheDocument();expect(screen.queryByText("Direct enrolment without an application")).not.toBeInTheDocument();expect(screen.queryByText("Issue student QR token")).not.toBeInTheDocument()});it("records attendance for learners in the assigned class",async()=>{recordAttendance.mockResolvedValue({sessionId:"session-1",recordedCount:1});render(<ClassroomWorkspace workspace={workspace} onRefresh={async()=>undefined}/>);fireEvent.click(screen.getByRole("button",{name:/submit attendance evidence/i}));await waitFor(()=>expect(recordAttendance).toHaveBeenCalledWith(expect.objectContaining({className:"Form 4A",marks:expect.arrayContaining([expect.objectContaining({studentId:demoLearners[0].id,status:"present"})])})))})});
