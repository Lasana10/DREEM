// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
 it("renders the shared French language without changing workflow actions",()=>{
  render(<LanguageContext.Provider value={{language:"fr",setLanguage:()=>undefined,toggle:()=>undefined,text:(_en,fr)=>fr}}><ActionCentre workspace={workspace} onNavigate={vi.fn()}/></LanguageContext.Provider>);
  expect(screen.getByText("VOTRE CENTRE D’ACTIONS")).toBeInTheDocument();
  expect(screen.getByText("Suivi")).toBeInTheDocument();
 });
});
