// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoAcademics,demoAdmissions,demoBrand,demoFinance,demoLearners,demoSetup,demoSignals,demoStudentCases,demoTeachers,demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import FamilyLearningWorkspace from "./FamilyLearningWorkspace";

const { loadStatement, loadCircle } = vi.hoisted(() => ({ loadStatement: vi.fn(), loadCircle: vi.fn() }));
vi.mock("../lib/familyFinance", () => ({ loadLearnerFeeStatement: loadStatement }));
vi.mock("../lib/pickupCircle", () => ({ loadPickupCircle: loadCircle }));

const base: WorkspaceData = {
  viewer: { id: "parent-1", name: "Guardian", email: "guardian@example.test", role: "parent" },
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

describe("Family app", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadStatement.mockReset().mockResolvedValue([]);
    loadCircle.mockReset().mockResolvedValue([]);
  });
  afterEach(cleanup);

  it("shows guardians a private child-scoped experience", () => {
    render(<FamilyLearningWorkspace workspace={base} />);
    expect(screen.getByText("DREEM FAMILY")).toBeInTheDocument();
    expect(screen.getByText(/Your children, one calm view/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Demo Learner A/i })).toBeInTheDocument();
  });

  it("does not let Family impersonate the learner to submit schoolwork", () => {
    render(<FamilyLearningWorkspace workspace={{ ...base, learners: [demoLearners[0]] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Learning" }));
    expect(screen.getByText(/Assignments and submission status/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit work" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Written response")).not.toBeInTheDocument();
  });

  it("hides the previous child's private records when switching and the next request fails", async () => {
    const first = demoLearners[0];
    const second = { ...first, id: "second-child", name: "Second Child" };
    loadCircle.mockResolvedValueOnce([{ collectorId: "collector-1", fullName: "First Child Collector", relationship: "Aunt", phoneLast4: "1234", status: "active", validUntil: "", lastReleaseAt: "" }]);
    loadCircle.mockRejectedValueOnce({ message: "Pickup access denied" });
    render(<FamilyLearningWorkspace workspace={{ ...base, learners: [first, second] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Transport" }));
    await screen.findByText(/First Child Collector/);
    fireEvent.click(screen.getByRole("button", { name: /Second Child/i }));
    expect(screen.queryByText(/First Child Collector/)).not.toBeInTheDocument();
    await screen.findByText(/Pickup access denied/);
    expect(screen.queryByText(/First Child Collector/)).not.toBeInTheDocument();
    expect(loadCircle).toHaveBeenLastCalledWith(second.id);
  });
});
