// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoAcademics, demoAdmissions, demoBrand, demoFinance, demoLearners, demoSetup, demoSignals, demoStudentCases, demoTeachers, demoTransport } from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import AdmissionsView from "./AdmissionsView";

const recordAdmissionApplication = vi.fn();
const progressAdmissionApplication = vi.fn();
vi.mock("../lib/repository", async () => {
  const actual = await vi.importActual<typeof import("../lib/repository")>("../lib/repository");
  return { ...actual, recordAdmissionApplication: (...args: unknown[]) => recordAdmissionApplication(...args), progressAdmissionApplication: (...args: unknown[]) => progressAdmissionApplication(...args) };
});

const workspace: WorkspaceData = {
  viewer: { name: "Principal", email: "principal@example.test", role: "principal" }, brand: demoBrand, setup: demoSetup,
  operations: { invitations: [], memberships: [{ id: "m1", profileId: "staff-1", name: "Admissions Lead", role: "administrator", status: "approved" }], recentAttendance: 0, recentAssessments: 0 },
  learners: demoLearners, teachers: demoTeachers, signals: demoSignals, cases: demoStudentCases, admissions: demoAdmissions, academics: demoAcademics, transport: demoTransport, finance: demoFinance,
};
const submittedWorkspace = { ...workspace, admissions: [{ ...demoAdmissions[0], status: "submitted" as const }] };
const acceptedWorkspace = { ...workspace, admissions: [{ ...demoAdmissions[0], status: "accepted" as const }] };
const terminalWorkspace = { ...workspace, admissions: [{ ...demoAdmissions[0], status: "enrolled" as const }] };

describe("Admissions workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordAdmissionApplication.mockResolvedValue({ applicationId: "a2", applicationNumber: "ADM-26-NEW", status: "submitted" });
    progressAdmissionApplication.mockResolvedValue({ applicationId: "admission-demo-1", status: "offered" });
  });
  afterEach(cleanup);

  it("captures required guardian declarations with the application", async () => {
    render(<AdmissionsView workspace={workspace} onRefresh={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.change(screen.getByLabelText("Learner full name"), { target: { value: "Applicant Learner" } });
    fireEvent.change(screen.getByLabelText("Target class"), { target: { value: "Form 1" } });
    fireEvent.change(screen.getByLabelText("Guardian full name"), { target: { value: "Applicant Guardian" } });
    fireEvent.click(screen.getByLabelText(/information is accurate/i));
    fireEvent.click(screen.getByLabelText(/authorises processing/i));
    fireEvent.click(screen.getByRole("button", { name: /submit application/i }));
    await waitFor(() => expect(recordAdmissionApplication).toHaveBeenCalledWith(expect.objectContaining({ learnerFullName: "Applicant Learner", guardianFullName: "Applicant Guardian", consentAccuracy: true, consentDataProcessing: true })));
  });

  it("presents one recommended action instead of a status selector", async () => {
    render(<AdmissionsView workspace={workspace} onRefresh={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByRole("button", { name: /approve and send offer/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Decision / action evidence"), { target: { value: "Leadership approved the evidence." } });
    fireEvent.click(screen.getByRole("button", { name: /approve and send offer/i }));
    await waitFor(() => expect(progressAdmissionApplication).toHaveBeenCalledWith(expect.objectContaining({ applicationId: "admission-demo-1", targetStatus: "offered" })));
  });

  it("does not expose acceptance directly from a submitted application", () => {
    render(<AdmissionsView workspace={submittedWorkspace} onRefresh={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByRole("button", { name: /start application review/i })).toBeInTheDocument();
    expect(screen.queryByText("Record guardian acceptance")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Opening fee balance")).not.toBeInTheDocument();
  });

  it("enrols an accepted applicant, creates the OneFile and opens learners", async () => {
    progressAdmissionApplication.mockResolvedValue({ applicationId: "admission-demo-1", status: "enrolled", matricule: "DRM-26-ABCDE", enrolledStudentId: "student-1" });
    const onOpenLearners = vi.fn();
    render(<AdmissionsView workspace={acceptedWorkspace} onRefresh={vi.fn().mockResolvedValue(undefined)} onOpenLearners={onOpenLearners} />);
    expect(screen.getByLabelText("Opening fee balance")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Decision / action evidence"), { target: { value: "Acceptance and enrolment documents verified." } });
    fireEvent.click(screen.getByRole("button", { name: /enrol and create learner onefile/i }));
    await waitFor(() => expect(onOpenLearners).toHaveBeenCalled());
  });

  it("blocks terminal admission records from being progressed again", () => {
    render(<AdmissionsView workspace={terminalWorkspace} onRefresh={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByText("This application is already enrolled.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /no further action/i })).toBeDisabled();
  });
});
