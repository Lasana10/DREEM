// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { demoAcademics, demoAdmissions, demoBrand, demoFinance, demoLearners, demoSetup, demoSignals, demoStudentCases, demoTeachers, demoTransport } from "../domain/demo";
import type { Role } from "../domain/types";
import type { WorkspaceData } from "../lib/repository";
import TransportView from "./TransportView";

function workspaceFor(role: Role): WorkspaceData {
  return { viewer:{name:"Role tester",email:"role@example.test",role},brand:demoBrand,setup:demoSetup,operations:{invitations:[],memberships:[],recentAttendance:0,recentAssessments:0},learners:demoLearners,teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,admissions:demoAdmissions,academics:demoAcademics,transport:demoTransport,finance:demoFinance };
}

describe("role-specific transport workspaces",()=>{
  afterEach(cleanup);
  it("gives gate officers verification without transport administration",()=>{
    render(<TransportView workspace={workspaceFor("security_guard")} onRefresh={async()=>undefined}/>);
    expect(screen.getByRole("heading",{name:"Scan both credentials"})).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Activate route"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Register vehicle"})).not.toBeInTheDocument();
  });
  it.each(["parent","student"] as Role[])("keeps %s transport read-only",(role)=>{
    render(<TransportView workspace={workspaceFor(role)} onRefresh={async()=>undefined}/>);
    expect(screen.getByRole("heading",{name:"Learner routes and stops"})).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Activate route"})).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Gate decision")).not.toBeInTheDocument();
  });
});
