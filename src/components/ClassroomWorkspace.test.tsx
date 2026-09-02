// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  demoAcademics,
  demoAdmissions,
  demoBrand,
  demoFinance,
  demoLearners,
  demoSetup,
  demoSignals,
  demoStudentCases,
  demoTeachers,
  demoTransport,
} from "../domain/demo";
import type { WorkspaceData } from "../lib/repository";
import ClassroomWorkspace from "./ClassroomWorkspace";

const recordAttendance = vi.fn(),
  recordAssessment = vi.fn(),
  uploadAcademicDocument = vi.fn();
vi.mock("../lib/repository", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/repository")>(
      "../lib/repository",
    );
  return {
    ...actual,
    recordAttendance: (input: unknown) => recordAttendance(input),
    recordAssessment: (input: unknown) => recordAssessment(input),
    uploadAcademicDocument: (input: unknown) => uploadAcademicDocument(input),
  };
});
const workspace: WorkspaceData = {
  viewer: {
    id: "t1",
    name: "Demo Teacher A",
    email: "teacher@example.test",
    role: "teacher",
  },
  brand: demoBrand,
  setup: demoSetup,
  operations: {
    invitations: [],
    memberships: [],
    recentAttendance: 0,
    recentAssessments: 0,
  },
  learners: demoLearners,
  teachers: demoTeachers,
  signals: demoSignals,
  cases: demoStudentCases,
  admissions: demoAdmissions,
  academics: demoAcademics,
  transport: demoTransport,
  finance: demoFinance,
};
describe("teacher classroom workspace", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  it("shows only assigned classroom operations", () => {
    render(
      <ClassroomWorkspace
        workspace={workspace}
        onRefresh={async () => undefined}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /today's teaching/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Mathematics").length).toBeGreaterThan(0);
    expect(screen.queryByText("Invite staff")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Direct enrolment without an application"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Issue student QR token"),
    ).not.toBeInTheDocument();
  });
  it("records attendance for learners in the assigned class", async () => {
    recordAttendance.mockResolvedValue({
      sessionId: "session-1",
      recordedCount: 1,
    });
    render(
      <ClassroomWorkspace
        workspace={workspace}
        onRefresh={async () => undefined}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /submit attendance evidence/i }),
    );
    await waitFor(() =>
      expect(recordAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          className: "Form 4A",
          marks: expect.arrayContaining([
            expect.objectContaining({
              studentId: demoLearners[0].id,
              status: "present",
            }),
          ]),
        }),
      ),
    );
  });
  it("submits assessment paper, questions and syllabus objectives with marks", async () => {
    recordAssessment.mockResolvedValue({
      assessmentId: "assessment-1",
      marksCount: 2,
    });
    render(
      <ClassroomWorkspace
        workspace={workspace}
        onRefresh={async () => undefined}
      />,
    );
    fireEvent.change(screen.getAllByLabelText("Subject")[0], {
      target: { value: "sub-1" },
    });
    fireEvent.change(screen.getByLabelText("Assessment title"), {
      target: { value: "Sequence 1 Mathematics test" },
    });
    fireEvent.change(screen.getByLabelText("Paper or scan reference"), {
      target: { value: "Maths-Paper-S1.pdf" },
    });
    fireEvent.change(screen.getByLabelText("Syllabus objectives covered"), {
      target: { value: "Fractions and ratios" },
    });
    fireEvent.change(screen.getByLabelText("Questions or task scope"), {
      target: { value: "Questions 1 to 5" },
    });
    fireEvent.change(
      screen.getByLabelText("Marking guide or expected answers"),
      { target: { value: "Answer key moderated by subject panel" } },
    );
    const scoreInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(scoreInputs[2], { target: { value: "16" } });
    fireEvent.change(scoreInputs[3], { target: { value: "14" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: /submit assessment for independent review/i,
      }),
    );
    await waitFor(() =>
      expect(recordAssessment).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectId: "sub-1",
          title: "Sequence 1 Mathematics test",
          paperReference: "Maths-Paper-S1.pdf",
          syllabusObjectives: "Fractions and ratios",
          questionSummary: "Questions 1 to 5",
          markingGuide: "Answer key moderated by subject panel",
          marks: expect.arrayContaining([
            expect.objectContaining({
              studentId: demoLearners[0].id,
              score: 16,
            }),
          ]),
        }),
      ),
    );
  });
  it("shows the protected syllabus and exam upload workflow",()=>{render(<ClassroomWorkspace workspace={workspace} onRefresh={async()=>undefined}/>);expect(screen.getByRole("heading",{name:"Upload syllabuses, exam papers and resources"})).toBeInTheDocument();expect(screen.getByLabelText("Choose PDF, Word or scan")).toHaveAttribute("accept",expect.stringContaining(".pdf"));expect(screen.getByRole("button",{name:"Upload protected document"})).toBeEnabled()});
});
