// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoAcademics,demoAdmissions,demoBrand,demoFinance,demoLearners,demoSetup,demoSignals,demoStudentCases,demoTeachers,demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import SecurityGateView from "./SecurityGateView";

vi.mock("../lib/gateOffline",()=>({prepareGateOfflineContext:vi.fn(),queueOfflineGateDenial:vi.fn(async()=>({queued:true})),replayGateOffline:vi.fn(async()=>({synced:0,failed:0,tampered:0}))}));
vi.mock("../lib/identity",()=>({resolveIdentityMedia:vi.fn(async(value:string)=>value)}));

const workspace:WorkspaceData={viewer:{id:"gate-user",name:"Gate Officer",email:"gate@example.test",role:"security_guard"},brand:demoBrand,setup:demoSetup,operations:{invitations:[],memberships:[],recentAttendance:0,recentAssessments:0},learners:demoLearners,teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,admissions:demoAdmissions,academics:demoAcademics,transport:demoTransport,finance:demoFinance};

describe("DREEM Secure Gate",()=>{
  beforeEach(()=>Object.defineProperty(window.navigator,"onLine",{configurable:true,value:false}));
  afterEach(cleanup);
  it("blocks release authority when offline while leaving denial available",()=>{
    render(<SecurityGateView workspace={workspace} onRefresh={async()=>undefined}/>);
    expect(screen.getByText(/Offline · release blocked/i)).toBeInTheDocument();
    expect(screen.getByRole("option",{name:"Release learner"})).toBeDisabled();
    expect(screen.getByRole("option",{name:"Deny release"})).not.toBeDisabled();
    expect(screen.getByRole("button",{name:/Record denial offline/i})).toBeInTheDocument();
  });
});
