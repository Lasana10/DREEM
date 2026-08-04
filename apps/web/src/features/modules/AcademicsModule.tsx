import { useState } from "react";
import { hasUserPermission } from "../../lib/permissions";
import type {
  AssignmentSubmission,
  AttendanceRecord,
  ClassroomItem,
  StudentRecord,
  UserProfile
} from "../../shared/types";

interface AcademicsModuleProps {
  activeUser: UserProfile;
  students: StudentRecord[];
  attendance: AttendanceRecord[];
  continuityItems: ClassroomItem[];
  assignmentSubmissions: AssignmentSubmission[];
  onRecordAttendance: (studentId: string, status: "present" | "late" | "absent") => void;
  onCreateContinuityItem: (item: ClassroomItem) => Promise<void>;
  onSubmitAssignment: (
    submission: Omit<AssignmentSubmission, "id" | "submittedAt" | "status">
  ) => Promise<void>;
  onReviewSubmission: (
    submissionId: string,
    review: Pick<AssignmentSubmission, "feedback" | "score" | "status">
  ) => Promise<void>;
}

export function AcademicsModule({
  activeUser,
  students,
  attendance,
  continuityItems,
  assignmentSubmissions,
  onRecordAttendance,
  onCreateContinuityItem,
  onSubmitAssignment,
  onReviewSubmission
}: AcademicsModuleProps) {
  const [selectedClass, setSelectedClass] = useState("All classes");
  const [materialDraft, setMaterialDraft] = useState({
    title: "",
    subject: "",
    delivery: "assignment" as ClassroomItem["delivery"],
    audience: "student" as ClassroomItem["audience"],
    summary: "",
    dueDate: ""
  });
  const [submissionDraft, setSubmissionDraft] = useState({
    classroomItemId: "",
    studentId: "",
    response: ""
  });
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { feedback: string; score: string }>>({});
  const [publishMessage, setPublishMessage] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const atRiskCount = students.filter((student) => student.riskLevel !== "low").length;
  const presentCount = attendance.filter((entry) => entry.status === "present").length;
  const classOptions = ["All classes", ...new Set(students.map((student) => student.className))];
  const filteredStudents =
    selectedClass === "All classes"
      ? students
      : students.filter((student) => student.className === selectedClass);
  const filteredAttendance =
    selectedClass === "All classes"
      ? attendance
      : attendance.filter((entry) => entry.className === selectedClass);
  const quickSubmission = filteredStudents
    .map((student) => {
      const latest = attendance.find((entry) => entry.studentId === student.id);
      return `${student.fullName}:${latest?.status ?? "unmarked"}`;
    })
    .join(" | ");
  const canWriteAttendance = hasUserPermission(activeUser, "academics.attendance.write");
  const canManageLearning =
    activeUser.role === "teacher" || activeUser.role === "leadership" || activeUser.role === "support";
  const isTeacherWorkspace = activeUser.role === "teacher";
  const isFamilyWorkspace = activeUser.role === "student" || activeUser.role === "parent";
  const linkedFamilyStudents =
    activeUser.role === "parent"
      ? students.filter((student) => student.guardian === activeUser.name)
      : activeUser.role === "student"
        ? students.filter(
            (student) =>
              student.fullName === activeUser.name ||
              student.matricule === activeUser.matricule ||
              student.className.includes(activeUser.department)
          )
        : [];
  const explicitlyLinkedFamilyStudents =
    activeUser.role === "parent"
      ? students.filter((student) => student.parentUserIds?.includes(activeUser.id))
      : activeUser.role === "student"
        ? students.filter(
            (student) =>
              student.fullName === activeUser.name ||
              student.matricule === activeUser.matricule
          )
        : [];
  const resolvedFamilyStudents =
    explicitlyLinkedFamilyStudents.length > 0 ? explicitlyLinkedFamilyStudents : linkedFamilyStudents;
  const familyClassNames = new Set(resolvedFamilyStudents.map((student) => student.className));
  const publishedItems = continuityItems.filter((item) => {
    if (selectedClass === "All classes") {
      return item.delivery === "assignment" || item.delivery === "follow-up";
    }

    return item.className === selectedClass && (item.delivery === "assignment" || item.delivery === "follow-up");
  });

  async function submitMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPublishMessage("");

    if (!materialDraft.title.trim() || !materialDraft.subject.trim() || !materialDraft.summary.trim()) {
      setPublishMessage("Title, subject, and instructions are required.");
      return;
    }

    await onCreateContinuityItem({
      id: "",
      title: materialDraft.title.trim(),
      subject: materialDraft.subject.trim(),
      className: selectedClass === "All classes" ? undefined : selectedClass,
      delivery: materialDraft.delivery,
      audience: materialDraft.audience,
      summary: materialDraft.summary.trim(),
      dueDate: materialDraft.dueDate || undefined,
      publishedBy: activeUser.name,
      status: "published",
      storageProvider: "supabase"
    });

    setPublishMessage("Learning item published.");
    setMaterialDraft({
      title: "",
      subject: "",
      delivery: "assignment",
      audience: "student",
      summary: "",
      dueDate: ""
    });
  }

  async function submitAssignmentResponse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionMessage("");

    const item = continuityItems.find((entry) => entry.id === submissionDraft.classroomItemId);
    const student = resolvedFamilyStudents.find((entry) => entry.id === submissionDraft.studentId);

    if (!item || !student || !submissionDraft.response.trim()) {
      setSubmissionMessage("Choose the learner, assignment, and write the response before submitting.");
      return;
    }

    await onSubmitAssignment({
      classroomItemId: item.id,
      classroomTitle: item.title,
      studentId: student.id,
      studentName: student.fullName,
      className: student.className,
      submittedBy: activeUser.name,
      response: submissionDraft.response.trim()
    });

    setSubmissionDraft({
      classroomItemId: "",
      studentId: "",
      response: ""
    });
    setSubmissionMessage("Assignment submitted for teacher review.");
  }

  async function submitReview(submission: AssignmentSubmission, status: AssignmentSubmission["status"]) {
    const draft = reviewDrafts[submission.id] ?? { feedback: "", score: "" };

    await onReviewSubmission(submission.id, {
      feedback: draft.feedback.trim() || undefined,
      score: draft.score.trim() || undefined,
      status
    });

    setReviewDrafts((current) => ({
      ...current,
      [submission.id]: { feedback: "", score: "" }
    }));
  }

  const familyLearningItems = continuityItems.filter(
    (item) =>
      (item.audience === "student" || item.audience === "parent") &&
      (familyClassNames.size === 0 ||
        !item.className ||
        familyClassNames.has(item.className))
  );
  const teacherReflectionItems = continuityItems.filter((item) => item.audience === "teacher");
  const overdueFollowUps = (isFamilyWorkspace ? resolvedFamilyStudents : students).filter(
    (student) => student.riskLevel !== "low" || student.feeStatus === "overdue"
  );
  const latestRegisters = filteredAttendance.slice(0, 8);
  const openAssignmentItems = familyLearningItems.filter((item) => item.delivery === "assignment");
  const visibleSubmissions = isFamilyWorkspace
    ? assignmentSubmissions.filter((submission) =>
        resolvedFamilyStudents.some((student) => student.id === submission.studentId)
      )
    : assignmentSubmissions.filter(
        (submission) => selectedClass === "All classes" || submission.className === selectedClass
      );
  const pendingReviews = visibleSubmissions.filter((submission) => submission.status === "submitted");

  return (
    <section className="module-surface">
      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {isTeacherWorkspace
                ? "Teaching desk"
                : isFamilyWorkspace
                  ? "Learning journey"
                  : "Academic control"}
            </span>
            <h2>
              {isTeacherWorkspace
                ? "Class register and learner follow-up"
                : isFamilyWorkspace
                  ? "Assignments, notes, and student follow-up"
                  : "Academic risk, register, and continuity"}
            </h2>
          </div>
        </div>

        <div className="announcement-stats">
          <article className="signal-card good">
            <span>{isFamilyWorkspace ? "Linked learners" : "Present today"}</span>
            <strong>{isFamilyWorkspace ? resolvedFamilyStudents.length : presentCount}</strong>
          </article>
          <article className="signal-card warm">
            <span>{isFamilyWorkspace ? "Support flags" : "At risk"}</span>
            <strong>
              {isFamilyWorkspace
                ? resolvedFamilyStudents.filter((student) => student.riskLevel !== "low").length
                : atRiskCount}
            </strong>
          </article>
          <article className="signal-card cool">
            <span>{isFamilyWorkspace ? "Continuity packs" : "Attendance register"}</span>
            <strong>{isFamilyWorkspace ? familyLearningItems.length : attendance.length}</strong>
          </article>
          <article className="signal-card alert">
            <span>{isFamilyWorkspace ? "Submitted work" : "Pending review"}</span>
            <strong>{isFamilyWorkspace ? visibleSubmissions.length : pendingReviews.length}</strong>
          </article>
        </div>

        {!isFamilyWorkspace ? (
          <label className="composer">
            <span>Quick class filter</span>
            <select
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
            >
              {classOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <p className="section-copy">
          {isTeacherWorkspace
            ? "This register is tuned for fast class action: mark attendance, spot risk, and publish work."
            : isFamilyWorkspace
              ? "This workspace should help a student or parent see what matters next without wading through admin tools."
              : "This academic view shows where leadership and support teams should intervene quickly."}
        </p>

        {isFamilyWorkspace ? (
          <div className="table-list">
            {resolvedFamilyStudents.slice(0, 3).map((student) => (
                <article key={student.id} className="record-row">
                <div>
                  <strong>{student.fullName}</strong>
                  <p>
                    {student.className}
                    {student.matricule ? ` · ${student.matricule}` : ""}
                    {activeUser.role === "parent" ? ` · ${student.guardianRelation ?? "Learner"}` : ""}
                  </p>
                  <p>
                    Attendance {student.attendanceRate}% · Fee {student.feeStatus} · Risk {student.riskLevel}
                  </p>
                </div>
                <div className="action-row">
                  <span className="module-chip">{student.className}</span>
                  <span className="module-chip">{student.feeStatus}</span>
                </div>
              </article>
            ))}
            {resolvedFamilyStudents.length === 0 ? (
              <article className="record-row">
                <div>
                  <strong>No linked learner profile yet.</strong>
                  <p>
                    This workspace needs a real parent-child or student identity link so DREEM can personalize the learning view properly.
                  </p>
                </div>
                <span className="module-chip">identity setup</span>
              </article>
            ) : null}
          </div>
        ) : null}

        <div className="table-list">
          {isFamilyWorkspace
            ? familyLearningItems.slice(0, 8).map((item) => (
                <article key={item.id} className="record-row">
                  <div>
                    <strong>{item.title}</strong>
                    <p>
                      {item.subject}
                      {item.className ? ` · ${item.className}` : ""}
                      {item.dueDate ? ` · Due ${item.dueDate}` : ""}
                    </p>
                    <p>{item.summary}</p>
                  </div>
                  <div className="action-row">
                    <span className="module-chip">{item.delivery}</span>
                    <span className="module-chip">{item.audience}</span>
                  </div>
                </article>
              ))
            : filteredStudents.map((student) => (
                <article key={student.id} className="record-row">
                  <div>
                    <strong>{student.fullName}</strong>
                    <p>
                      {student.className} · Attendance {student.attendanceRate}% · Risk {student.riskLevel}
                    </p>
                  </div>
                  <div className="action-row">
                    {canWriteAttendance ? (
                      <>
                        <button
                          className="module-chip"
                          disabled={!canWriteAttendance}
                          onClick={() => onRecordAttendance(student.id, "present")}
                        >
                          Present
                        </button>
                        <button
                          className="module-chip"
                          disabled={!canWriteAttendance}
                          onClick={() => onRecordAttendance(student.id, "late")}
                        >
                          Late
                        </button>
                        <button
                          className="module-chip"
                          disabled={!canWriteAttendance}
                          onClick={() => onRecordAttendance(student.id, "absent")}
                        >
                          Absent
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="module-chip">{student.feeStatus}</span>
                        <span className="module-chip">{student.riskLevel}</span>
                      </>
                    )}
                  </div>
                </article>
              ))}
        </div>
      </section>

      {isFamilyWorkspace ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Assignment submission</span>
              <h2>Send work back to the teacher</h2>
            </div>
          </div>

          <form className="composer" onSubmit={submitAssignmentResponse}>
            <div className="composer-grid">
              <label>
                <span>Learner</span>
                <select
                  value={submissionDraft.studentId}
                  onChange={(event) =>
                    setSubmissionDraft((current) => ({ ...current, studentId: event.target.value }))
                  }
                >
                  <option value="">Choose learner</option>
                  {resolvedFamilyStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.fullName} - {student.className}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Assignment</span>
                <select
                  value={submissionDraft.classroomItemId}
                  onChange={(event) =>
                    setSubmissionDraft((current) => ({
                      ...current,
                      classroomItemId: event.target.value
                    }))
                  }
                >
                  <option value="">Choose assignment</option>
                  {openAssignmentItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                      {item.dueDate ? ` - due ${item.dueDate}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Response or parent note</span>
              <textarea
                rows={5}
                value={submissionDraft.response}
                onChange={(event) =>
                  setSubmissionDraft((current) => ({ ...current, response: event.target.value }))
                }
                placeholder="Paste the answer, describe the completed work, or add a parent confirmation note."
              />
            </label>
            <div className="action-row">
              <button className="primary-button" type="submit">
                Submit assignment
              </button>
            </div>
            {submissionMessage ? <p className="loading-note">{submissionMessage}</p> : null}
          </form>

          <div className="table-list">
            {visibleSubmissions.slice(0, 8).map((submission) => (
              <article key={submission.id} className="record-row">
                <div>
                  <strong>{submission.classroomTitle}</strong>
                  <p>
                    {submission.studentName}
                    {submission.className ? ` · ${submission.className}` : ""}
                    {submission.score ? ` · Score ${submission.score}` : ""}
                  </p>
                  <p>{submission.feedback ?? submission.response}</p>
                </div>
                <span className="module-chip">{submission.status}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {isFamilyWorkspace ? "Support watch" : "Daily register"}
            </span>
            <h2>
              {isFamilyWorkspace ? "Where attention may be needed" : "Latest attendance actions"}
            </h2>
          </div>
        </div>

        <div className="table-list">
          {isFamilyWorkspace
            ? overdueFollowUps.slice(0, 8).map((student) => (
                <article key={student.id} className="record-row">
                  <div>
                    <strong>{student.fullName}</strong>
                    <p>
                      {student.className} · Attendance {student.attendanceRate}% · Fee {student.feeStatus}
                    </p>
                    <p>Risk {student.riskLevel} follow-up may be needed.</p>
                  </div>
                  <span className="module-chip">{student.riskLevel}</span>
                </article>
              ))
            : latestRegisters.map((entry) => (
                <article key={entry.id} className="record-row">
                  <div>
                    <strong>{entry.studentName}</strong>
                    <p>
                      {entry.className} · {entry.date} · {entry.note}
                    </p>
                  </div>
                  <span className="module-chip">{entry.status}</span>
                </article>
              ))}
        </div>
      </section>

      {canManageLearning ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">
                {isTeacherWorkspace ? "Teacher publishing" : "Academic publishing"}
              </span>
              <h2>
                {isTeacherWorkspace
                  ? "Assignments and follow-up workflow"
                  : "Learning materials and intervention publishing"}
              </h2>
            </div>
          </div>

          <form className="composer" onSubmit={submitMaterial}>
            <div className="composer-grid">
              <label>
                <span>Title</span>
                <input
                  disabled={!canManageLearning}
                  value={materialDraft.title}
                  onChange={(event) =>
                    setMaterialDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Essay, worksheet, revision pack..."
                />
              </label>
              <label>
                <span>Subject</span>
                <input
                  disabled={!canManageLearning}
                  value={materialDraft.subject}
                  onChange={(event) =>
                    setMaterialDraft((current) => ({ ...current, subject: event.target.value }))
                  }
                  placeholder="English, Biology, Mathematics..."
                />
              </label>
              <label>
                <span>Delivery</span>
                <select
                  disabled={!canManageLearning}
                  value={materialDraft.delivery}
                  onChange={(event) =>
                    setMaterialDraft((current) => ({
                      ...current,
                      delivery: event.target.value as ClassroomItem["delivery"]
                    }))
                  }
                >
                  <option value="assignment">Assignment</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="notes">Notes</option>
                </select>
              </label>
              <label>
                <span>Audience</span>
                <select
                  disabled={!canManageLearning}
                  value={materialDraft.audience}
                  onChange={(event) =>
                    setMaterialDraft((current) => ({
                      ...current,
                      audience: event.target.value as ClassroomItem["audience"]
                    }))
                  }
                >
                  <option value="student">Students</option>
                  <option value="parent">Parents</option>
                  <option value="teacher">Teachers</option>
                </select>
              </label>
              <label>
                <span>Due date</span>
                <input
                  type="date"
                  disabled={!canManageLearning}
                  value={materialDraft.dueDate}
                  onChange={(event) =>
                    setMaterialDraft((current) => ({ ...current, dueDate: event.target.value }))
                  }
                />
              </label>
            </div>

            <label>
              <span>Instructions</span>
              <textarea
                disabled={!canManageLearning}
                value={materialDraft.summary}
                rows={4}
                onChange={(event) =>
                  setMaterialDraft((current) => ({ ...current, summary: event.target.value }))
                }
                placeholder="What should the learner or parent do next?"
              />
            </label>

            <div className="action-row">
              <button className="primary-button" disabled={!canManageLearning} type="submit">
                Publish learning item
              </button>
            </div>
            {publishMessage ? <p className="loading-note">{publishMessage}</p> : null}
          </form>

          <div className="table-list">
            {publishedItems.map((item) => (
              <article key={item.id} className="record-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>
                    {item.subject}
                    {item.className ? ` · ${item.className}` : ""}
                    {item.dueDate ? ` · Due ${item.dueDate}` : ""}
                  </p>
                  <p>{item.summary}</p>
                </div>
                <div className="action-row">
                  <span className="module-chip">{item.delivery}</span>
                  <span className="module-chip">{item.publishedBy ?? activeUser.name}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {canManageLearning ? (
        <section className="panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Submission review</span>
              <h2>Teacher feedback and completion control</h2>
            </div>
          </div>

          <div className="table-list">
            {visibleSubmissions.slice(0, 10).map((submission) => {
              const reviewDraft = reviewDrafts[submission.id] ?? { feedback: "", score: "" };

              return (
                <article key={submission.id} className="record-row review-row">
                  <div>
                    <strong>{submission.classroomTitle}</strong>
                    <p>
                      {submission.studentName}
                      {submission.className ? ` · ${submission.className}` : ""}
                      {submission.score ? ` · Score ${submission.score}` : ""}
                    </p>
                    <p>{submission.response}</p>
                    {submission.feedback ? <p>Feedback: {submission.feedback}</p> : null}
                  </div>
                  <div className="review-controls">
                    <input
                      value={reviewDraft.score}
                      onChange={(event) =>
                        setReviewDrafts((current) => ({
                          ...current,
                          [submission.id]: {
                            ...reviewDraft,
                            score: event.target.value
                          }
                        }))
                      }
                      placeholder="Score"
                    />
                    <textarea
                      value={reviewDraft.feedback}
                      onChange={(event) =>
                        setReviewDrafts((current) => ({
                          ...current,
                          [submission.id]: {
                            ...reviewDraft,
                            feedback: event.target.value
                          }
                        }))
                      }
                      rows={3}
                      placeholder="Feedback for learner or parent"
                    />
                    <div className="module-chip-row">
                      <button
                        className="module-chip"
                        onClick={() => void submitReview(submission, "reviewed")}
                      >
                        Mark reviewed
                      </button>
                      <button
                        className="module-chip"
                        onClick={() => void submitReview(submission, "needs-revision")}
                      >
                        Needs revision
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            {visibleSubmissions.length === 0 ? (
              <article className="record-row">
                <div>
                  <strong>No submissions yet.</strong>
                  <p>Student and parent submissions will appear here once assignments are returned.</p>
                </div>
                <span className="module-chip">waiting</span>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {isTeacherWorkspace ? "Teacher simple submission" : "Role support"}
            </span>
            <h2>
              {isTeacherWorkspace
                ? "Low-friction attendance summary"
                : isFamilyWorkspace
                  ? "Current learning snapshot"
                  : "Academic intervention summary"}
            </h2>
          </div>
        </div>

        <label className="composer">
          <span>
            {isTeacherWorkspace
              ? "Shareable class summary"
              : isFamilyWorkspace
                ? "Family-facing quick view"
                : "Leadership intervention summary"}
          </span>
          <textarea
            value={
              isTeacherWorkspace
                ? quickSubmission
                : isFamilyWorkspace
                  ? familyLearningItems
                      .slice(0, 6)
                      .map((item) => `${item.title}: ${item.delivery}${item.dueDate ? ` due ${item.dueDate}` : ""}`)
                      .join(" | ")
                  : teacherReflectionItems
                      .slice(0, 6)
                      .map((item) => `${item.title}: ${item.summary}`)
                      .join(" | ")
            }
            readOnly
            rows={5}
          />
        </label>
      </section>
    </section>
  );
}
