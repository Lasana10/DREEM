// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoAcademics,demoAdmissions,demoBrand,demoFinance,demoLearners,demoSetup,demoSignals,demoStudentCases,demoTeachers,demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import LearningWorkspace from "./LearningWorkspace";

const createAssignment=vi.fn(),submitAssignment=vi.fn(),publishAssignment=vi.fn();
vi.mock("../lib/repository",async()=>{const actual=await vi.importActual<typeof import("../lib/repository")>("../lib/repository");return{...actual,createAssignment:(...a:unknown[])=>createAssignment(...a),submitAssignment:(...a:unknown[])=>submitAssignment(...a),publishAssignment:(...a:unknown[])=>publishAssignment(...a)}});
const base:WorkspaceData={viewer:{id:"t1",name:"Teacher",email:"teacher@example.test",role:"teacher"},brand:demoBrand,setup:demoSetup,operations:{invitations:[],memberships:[],recentAttendance:0,recentAssessments:0},learners:demoLearners,teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,admissions:demoAdmissions,academics:demoAcademics,transport:demoTransport,finance:demoFinance};

describe("Assignment lifecycle",()=>{beforeEach(()=>{vi.clearAllMocks();createAssignment.mockResolvedValue("new-assignment");submitAssignment.mockResolvedValue({submissionId:"s1",status:"submitted",attempt:1});publishAssignment.mockResolvedValue("published")});afterEach(cleanup);
it("lets teachers create outcome-linked work",async()=>{render(<LearningWorkspace workspace={base} onRefresh={vi.fn().mockResolvedValue(undefined)}/>);fireEvent.change(screen.getByLabelText("Teaching assignment"),{target:{value:"assign-1"}});fireEvent.change(screen.getByLabelText("Title"),{target:{value:"Fractions practice"}});fireEvent.change(screen.getByLabelText("Due date and time"),{target:{value:"2026-09-20T16:00"}});fireEvent.change(screen.getByLabelText("Instructions"),{target:{value:"Complete all ten questions."}});fireEvent.click(screen.getByRole("button",{name:"Create assignment draft"}));await waitFor(()=>expect(createAssignment).toHaveBeenCalledWith(expect.objectContaining({title:"Fractions practice",teachingAssignmentId:"assign-1",maxScore:20}))) });
it("gives learners a protected submission form without grading controls",()=>{render(<LearningWorkspace workspace={{...base,viewer:{id:"student-1",name:"Learner",email:"learner@example.test",role:"student"}}} onRefresh={vi.fn().mockResolvedValue(undefined)}/>);expect(screen.getByRole("button",{name:"Submit assignment"})).toBeEnabled();expect(screen.queryByRole("button",{name:"Record feedback"})).not.toBeInTheDocument()});
});
