// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageContext } from "../lib/languageContext";
import { demoAcademics, demoAdmissions, demoBrand, demoFinance, demoLearners, demoSetup, demoSignals, demoStudentCases, demoTeachers, demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import ActionCentre from "./ActionCentre";
const workspace:WorkspaceData={
 viewer:{id:"lead",name:"Leader",email:"lead@example.test",role:"school_owner"},
 brand:demoBrand,setup:demoSetup,operations:{invitations:[],memberships:[],recentAttendance:0,recentAssessments:0},
 learners:demoLearners,teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,admissions:demoAdmissions,academics:demoAcademics,transport:demoTransport,finance:demoFinance
};
afterEach(cleanup);
describe("Institution action centre bilingual presentation",()=>{
 it("takes an enrolment finance-link failure to the finance owner",()=>{
  const learner={...demoLearners[0],feeAccountId:undefined};
  const admission={...demoAdmissions[0],status:"enrolled" as const,enrolledStudentId:learner.id};
  const onNavigate=vi.fn();
  render(<ActionCentre workspace={{...workspace,learners:[learner],admissions:[admission]}} onNavigate={onNavigate}/>);
  const row=screen.getByText("Enrolment did not reach learner finance").closest(".action-centre-row");
  expect(row).not.toBeNull();
  const button=row?.querySelector("button");
  expect(button).not.toBeNull();
  fireEvent.click(button!);
  expect(onNavigate).toHaveBeenCalledWith("finance");
 });

 it("renders the shared French language without changing workflow actions",()=>{
  render(<LanguageContext.Provider value={{language:"fr",setLanguage:()=>undefined,toggle:()=>undefined,text:(_en,fr)=>fr}}><ActionCentre workspace={workspace} onNavigate={vi.fn()}/></LanguageContext.Provider>);
  expect(screen.getByText("VOTRE CENTRE D’ACTIONS")).toBeInTheDocument();
  expect(screen.getByText("Suivi")).toBeInTheDocument();
 });
 it("does not assign independent academic moderation to a teaching-only role",()=>{
  const teacher:WorkspaceData={...workspace,viewer:{id:"teach",name:"Teacher",email:"teacher@example.test",role:"teacher",authorityScopes:["academics_delivery"]}};
  render(<ActionCentre workspace={teacher} onNavigate={vi.fn()}/>);
  expect(screen.queryByText("Assessments awaiting moderation")).not.toBeInTheDocument();
 });
 it("shows academic moderation when the actual approval authority is delegated",()=>{
  const academicHead:WorkspaceData={...workspace,viewer:{id:"head",name:"Head",email:"head@example.test",role:"academic_head",authorityScopes:["academics_approval"]}};
  render(<ActionCentre workspace={academicHead} onNavigate={vi.fn()}/>);
  expect(screen.getByText("Assessments awaiting moderation")).toBeInTheDocument();
 });
 it("does not present admissions decision queue to intake-only staff",()=>{
  const admissionsOfficer:WorkspaceData={...workspace,viewer:{id:"office",name:"Office",email:"office@example.test",role:"administrator",authorityScopes:["admissions_intake"]}};
  render(<ActionCentre workspace={admissionsOfficer} onNavigate={vi.fn()}/>);
  expect(screen.queryByText("Admissions still in progress")).not.toBeInTheDocument();
 });

});
