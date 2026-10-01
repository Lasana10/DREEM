// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAcademics,demoAdmissions,demoBrand,demoFinance,demoLearners,demoSetup,demoSignals,demoStudentCases,demoTeachers,demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import SchoolCommandCentre from "./SchoolCommandCentre";

afterEach(cleanup);

const workspace:WorkspaceData={
  viewer:{id:"principal-1",name:"Principal Test",email:"principal@example.test",role:"principal",positionTitle:"Principal",authorityScopes:["institutional_leadership","admissions_decision","academics_approval","finance_approval","transport_management","safeguarding","communications_publish"]},
  brand:demoBrand,setup:demoSetup,operations:{invitations:[],memberships:[],recentAttendance:0,recentAssessments:0},
  learners:demoLearners,teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,admissions:demoAdmissions,academics:demoAcademics,transport:demoTransport,finance:demoFinance,
};

describe("SchoolCommandCentre operational excellence",()=>{
  it("shows school flow and follow-up in plain language",()=>{
    render(<SchoolCommandCentre workspace={workspace} onNavigate={vi.fn()}/>);
    expect(screen.getByText(/your action centre/i)).toBeInTheDocument();
    expect(screen.getByText(/school flow/i)).toBeInTheDocument();
    expect(screen.getByRole("heading",{name:/core school processes are connected/i})).toBeInTheDocument();
    expect(screen.getByText(/school today/i)).toBeInTheDocument();
    expect(screen.getByText(/what dreem noticed/i)).toBeInTheDocument();
    expect(screen.getByText(/what this is based on/i)).toBeInTheDocument();
    expect(screen.getByText(/close the money loop|protect people first|fix the broken step|learner attention|school status/i)).toBeInTheDocument();
  });
});
