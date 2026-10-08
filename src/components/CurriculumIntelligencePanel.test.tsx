// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAcademics, demoAdmissions, demoBrand, demoFinance, demoLearners, demoSetup, demoSignals, demoStudentCases, demoTeachers, demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import CurriculumIntelligencePanel from "./CurriculumIntelligencePanel";

const base:WorkspaceData={
 viewer:{id:"head",name:"Academic Head",email:"head@example.test",role:"academic_head"},
 brand:demoBrand,setup:demoSetup,operations:{invitations:[],memberships:[],recentAttendance:0,recentAssessments:0},
 learners:demoLearners,teachers:demoTeachers,signals:demoSignals,cases:demoStudentCases,
 admissions:demoAdmissions,academics:demoAcademics,transport:demoTransport,finance:demoFinance,
};
afterEach(cleanup);
describe("Curriculum provenance guardrails",()=>{
 it("does not allow academic approval before teacher verification",()=>{
  const doc=demoAcademics.documents.find(item=>item.documentType==="syllabus");
  if(!doc)throw new Error("Demo syllabus missing");
  const proposal={id:"pending-1",documentId:doc.id,documentVersion:1,academicYearId:"year",classId:"class",subjectId:doc.subjectId??"",proposedCode:"MATH-01",proposedTitleEn:"Fractions",extractionProvider:"human",sourcePageStart:3,status:"proposed" as const,createdAt:"2026-10-08T08:00:00Z"};
  const academics={...demoAcademics,curriculumProposals:[proposal]};
  render(<CurriculumIntelligencePanel workspace={{...base,academics}} onRefresh={vi.fn().mockResolvedValue(undefined)}/>);
  expect(screen.getByRole("button",{name:"Record academic decision"})).toBeDisabled();
  expect(screen.getByText(/not reviewed yet/)).toBeInTheDocument();
 });
});
