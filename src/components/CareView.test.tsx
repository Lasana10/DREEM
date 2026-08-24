// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoAcademics, demoAdmissions, demoBrand, demoFinance, demoLearners, demoSetup, demoSignals, demoStudentCases, demoTeachers, demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import CareView from "./CareView";

const openStudentCase=vi.fn();
const progressStudentCase=vi.fn();

vi.mock("../lib/repository",async()=>{
  const actual=await vi.importActual<typeof import("../lib/repository")>("../lib/repository");
  return {...actual,openStudentCase:(...args:unknown[])=>openStudentCase(...args),progressStudentCase:(...args:unknown[])=>progressStudentCase(...args)};
});

const workspace:WorkspaceData={
  viewer:{name:"Test Principal",email:"principal@example.test",role:"principal"},brand:demoBrand,setup:demoSetup,
  operations:{invitations:[],memberships:[{id:"m1",profileId:"staff-1",name:"Care Lead",role:"academic_head",status:"approved"}],recentAttendance:0,recentAssessments:0},
  learners:demoLearners,teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,admissions:demoAdmissions,academics:demoAcademics,transport:demoTransport,finance:demoFinance,
};

describe("Care and safeguarding workflow",()=>{
  beforeEach(()=>{vi.clearAllMocks();openStudentCase.mockResolvedValue({caseId:"case-2",caseNumber:"DCS-26-NEW",status:"assigned"});progressStudentCase.mockResolvedValue({caseId:"case-demo-1",status:"resolved"});});
  afterEach(()=>cleanup());

  it("opens a protected learner case with an owner and review date",async()=>{
    const onRefresh=vi.fn().mockResolvedValue(undefined);
    render(<CareView workspace={workspace} onRefresh={onRefresh}/>);
    fireEvent.change(screen.getByLabelText("Learner"),{target:{value:"2"}});
    fireEvent.change(screen.getByLabelText("Category"),{target:{value:"safeguarding"}});
    fireEvent.change(screen.getByLabelText("Priority"),{target:{value:"urgent"}});
    fireEvent.change(screen.getAllByLabelText("Assign to")[0],{target:{value:"staff-1"}});
    fireEvent.change(screen.getByLabelText("Case title"),{target:{value:"Immediate learner welfare review"}});
    fireEvent.change(screen.getByLabelText("Factual summary"),{target:{value:"A dated concern was reported and immediate leadership review is required."}});
    fireEvent.click(screen.getByRole("button",{name:/open protected case/i}));
    await waitFor(()=>expect(openStudentCase).toHaveBeenCalledWith(expect.objectContaining({studentId:"2",category:"safeguarding",priority:"urgent",assignedTo:"staff-1"})));
    expect(await screen.findByText(/DCS-26-NEW/)).toBeInTheDocument();
    expect(onRefresh).toHaveBeenCalled();
  });

  it("requires an evidence note when progressing a case",async()=>{
    render(<CareView workspace={workspace} onRefresh={vi.fn().mockResolvedValue(undefined)}/>);
    fireEvent.change(screen.getByLabelText("Next state"),{target:{value:"resolved"}});
    fireEvent.change(screen.getByLabelText("Evidence / action / outcome"),{target:{value:"Support action completed and the learner response was reviewed."}});
    fireEvent.click(screen.getByRole("button",{name:/record case action/i}));
    await waitFor(()=>expect(progressStudentCase).toHaveBeenCalledWith(expect.objectContaining({caseId:"case-demo-1",targetStatus:"resolved"})));
  });
});
