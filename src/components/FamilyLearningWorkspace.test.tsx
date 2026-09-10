// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoAcademics,demoAdmissions,demoBrand,demoFinance,demoLearners,demoSetup,demoSignals,demoStudentCases,demoTeachers,demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import FamilyLearningWorkspace from "./FamilyLearningWorkspace";

const submitAssignment = vi.fn();
vi.mock("../lib/repository", async () => {
  const actual = await vi.importActual<typeof import("../lib/repository")>("../lib/repository");
  return { ...actual, submitAssignment: (...args: unknown[]) => submitAssignment(...args) };
});

const base: WorkspaceData = {
  viewer: { id: "student-1", name: "Learner", email: "learner@example.test", role: "student" },
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

describe("Family learning app", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitAssignment.mockResolvedValue({ submissionId: "s1", status: "submitted", attempt: 1 });
  });
  afterEach(cleanup);

  it("shows students a learner-only experience without teacher authoring", () => {
    render(<FamilyLearningWorkspace workspace={base} onRefresh={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByText("DREEM STUDENT")).toBeInTheDocument();
    expect(screen.queryByText("TEACHER AUTHORING")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit work" })).toBeEnabled();
  });

  it("shows guardians a child-scoped experience", () => {
    render(<FamilyLearningWorkspace workspace={{ ...base, viewer: { id: "parent-1", name: "Guardian", email: "guardian@example.test", role: "parent" } }} onRefresh={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByText("DREEM FAMILY")).toBeInTheDocument();
    expect(screen.getByText(/Only linked children/i)).toBeInTheDocument();
  });

  it("submits evidence for the selected authorised learner", async () => {
    const learner = demoLearners[0];
    render(<FamilyLearningWorkspace workspace={{ ...base, learners: [learner] }} onRefresh={vi.fn().mockResolvedValue(undefined)} />);
    const assignment = demoAcademics.assignmentsForLearners.find((item) => item.status === "published" && item.className === learner.className);
    expect(assignment).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Assignment"), { target: { value: assignment!.id } });
    fireEvent.change(screen.getByLabelText("Written response"), { target: { value: "Completed work" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit work" }));
    await waitFor(() => expect(submitAssignment).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: assignment!.id, studentId: learner.id, responseText: "Completed work" })));
  });
});
