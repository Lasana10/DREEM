// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
  afterEach(cleanup);
  it("shows only the assigned journey operations instead of fleet administration",()=>{
    render(<DriverWorkspace workspace={workspace} onRefresh={async()=>undefined}/>);
    expect(screen.getByRole("heading",{name:"Drive the assigned trip. Record what actually happens."})).toBeInTheDocument();
    expect(screen.getByText("Morning Route")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Record journey event"})).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Activate route"})).not.toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"Register vehicle"})).not.toBeInTheDocument();
  });
});
