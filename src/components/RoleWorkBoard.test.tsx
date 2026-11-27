// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {demoAcademics,demoAdmissions,demoBrand,demoFinance,demoLearners,demoSetup,demoSignals,demoStudentCases,demoTeachers,demoTransport} from "../domain/demo";
import type {WorkspaceData} from "../lib/repository";
import {roleWorkQueues} from "../lib/roleWorkQueues";
import RoleWorkBoard from "./RoleWorkBoard";
import {LanguageContext} from "../lib/languageContext";

const baseline:WorkspaceData={
 viewer:{id:"lead",name:"Leader",email:"lead@example.test",role:"principal",authorityScopes:["institutional_leadership","academics_approval","admissions_decision"]},
 brand:demoBrand,setup:demoSetup,operations:{invitations:[],memberships:[],recentAttendance:0,recentAssessments:0},
 learners:demoLearners,teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,admissions:demoAdmissions,academics:demoAcademics,transport:demoTransport,finance:demoFinance,
};
afterEach(cleanup);
describe("role-owned school work states",()=>{
 it("routes actual review ownership only to independent academic approvers",()=>{
  const tasks=roleWorkQueues(baseline);
  expect(tasks.some(x=>x.id==="assessment-moderation"&&x.lane==="needs")).toBe(true);
  expect(tasks.some(x=>x.id==="academic-reviewed"&&x.lane==="done")).toBe(true);
  const teacher:WorkspaceData={...baseline,viewer:{id:"t1",name:"Teacher",email:"teacher@example.test",role:"teacher",authorityScopes:["academics_delivery"]}};
  const own=roleWorkQueues(teacher);
  expect(own.some(x=>x.id==="assessment-moderation")).toBe(false);
  expect(own.some(x=>x.id==="teacher-assessment-awaiting"&&x.lane==="waiting")).toBe(true);
  expect(own.some(x=>x.id==="teacher-reviewed"&&x.lane==="done")).toBe(true);
 });
 it("does not give admissions intake officers a decision queue",()=>{
  const office:WorkspaceData={...baseline,viewer:{id:"office",name:"Office",email:"office@example.test",role:"administrator",authorityScopes:["admissions_intake"]}};
  expect(roleWorkQueues(office).some(x=>x.id==="admissions-decision")).toBe(false);
 });
 it("shows the Needs me, Waiting, Done lanes and navigates to the actual owner workspace",()=>{
  const onNavigate=vi.fn();
  render(<RoleWorkBoard workspace={baseline} onNavigate={onNavigate}/>);
  expect(screen.getByRole("tab",{name:/Needs me/i})).toBeInTheDocument();
  const reviewRow=screen.getByText("Moderate assessments").closest(".action-row");
  expect(reviewRow).not.toBeNull();
  fireEvent.click(reviewRow!.querySelector("button")!);
  expect(onNavigate).toHaveBeenCalledWith("academics");
  fireEvent.click(screen.getByRole("tab",{name:/Done/i}));
  expect(screen.getByText("Reviewed lesson plans")).toBeInTheDocument();
 });
 it("localises the queue consistently without exposing unrelated protected domains",()=>{
  const teacher:WorkspaceData={...baseline,viewer:{id:"t1",name:"Teacher",email:"teacher@example.test",role:"teacher",authorityScopes:["academics_delivery"]}};
  render(<LanguageContext.Provider value={{language:"fr",setLanguage:()=>undefined,toggle:()=>undefined,text:(_en,fr)=>fr}}><RoleWorkBoard workspace={teacher} onNavigate={vi.fn()}/></LanguageContext.Provider>);
  expect(screen.getByRole("tab",{name:/En attente/i})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab",{name:/En attente/i}));
  expect(screen.getByText("Évaluations en cours de modération")).toBeInTheDocument();
  expect(screen.queryByText("Contrôler les exceptions financières")).not.toBeInTheDocument();
 });
});
