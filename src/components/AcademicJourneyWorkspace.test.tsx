// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAcademics, demoAdmissions, demoBrand, demoFinance, demoLearners, demoSetup, demoSignals, demoStudentCases, demoTeachers, demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import AcademicJourneyWorkspace from "./AcademicJourneyWorkspace";

vi.mock("./CurriculumIntelligencePanel", () => ({ default: () => null }));

const workspace: WorkspaceData = {
  viewer: { name: "Academic Head", email: "academics@example.test", role: "academic_head" },
  brand: demoBrand,
  setup: demoSetup,
  operations: { invitations: [], memberships: [], recentAttendance: 0, recentAssessments: 0 },
  learners: demoLearners,
  teachers: demoTeachers,
  signals: demoSignals,
  cases: demoStudentCases,
  admissions: demoAdmissions,
  academics: demoAcademics,
  transport: demoTransport,
  finance: demoFinance,
};

describe("Academic task journey", () => {
  afterEach(cleanup);

  it("opens only the academic stage chosen by the reviewer", () => {
    render(<AcademicJourneyWorkspace workspace={workspace} onRefresh={vi.fn().mockResolvedValue(undefined)} onOpenStudio={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Curriculum outcomes" }));
    expect(screen.getByRole("button", { name: "Save curriculum outcome" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Timetable" }));
    expect(screen.getByRole("button", { name: "Schedule period" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save curriculum outcome" })).not.toBeInTheDocument();
  });
});
