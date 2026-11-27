// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoAcademics, demoAdmissions, demoBrand, demoFinance, demoLearners, demoSetup, demoSignals, demoStudentCases, demoTeachers, demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import DriverWorkspace from "./DriverWorkspace";

const transport={
  ...demoTransport,
  drivers:[{id:"driver-record",userId:"driver-user",name:"School Driver",licenseReference:"LIC-01",licenseExpiresOn:"2027-12-31",status:"active" as const}],
  trips:[{id:"trip-1",routeId:"route-1",routeName:"Morning Route",vehicleId:"vehicle-1",vehicleCode:"BUS-01",driverId:"driver-record",driverName:"School Driver",serviceDate:"2026-09-11",direction:"inbound" as const,status:"dispatched" as const,assignedStudents:1,scheduledDeparture:"06:30"}],
};
const workspace:WorkspaceData={viewer:{id:"driver-user",name:"School Driver",email:"driver@example.test",role:"driver"},brand:demoBrand,setup:demoSetup,operations:{invitations:[],memberships:[],recentAttendance:0,recentAssessments:0},learners:demoLearners,teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,admissions:demoAdmissions,academics:demoAcademics,transport,finance:demoFinance};

describe("DREEM Driver",()=>{
  beforeEach(()=>{vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-09-11T08:00:00Z"));});
  afterEach(()=>{cleanup();vi.useRealTimers();});
  it("shows only the assigned journey operations instead of fleet administration",()=>{
    render(<DriverWorkspace workspace={workspace} onRefresh={async()=>undefined}/>);
    expect(screen.getByRole("heading",{name:"Morning Route"})).toBeInTheDocument();
    expect(screen.getByText("Morning Route")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Start / depart"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Delay"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Finish"})).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Activate route"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Register vehicle"})).not.toBeInTheDocument();
  });
  it("does not expose stale or future pupil boarding controls as today's trip",()=>{
    vi.setSystemTime(new Date("2026-11-27T08:00:00Z"));
    render(<DriverWorkspace workspace={workspace} onRefresh={async()=>undefined}/>);
    expect(screen.getByRole("heading",{name:"Waiting for today's trip"})).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Start / depart"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Boarded"})).not.toBeInTheDocument();
    expect(screen.getByText(/Historical and future routes cannot be started/i)).toBeInTheDocument();
  });

});
