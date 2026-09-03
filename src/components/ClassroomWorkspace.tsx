import { useState, type FormEvent } from "react";
import {
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";
import type { AttendanceCommand } from "../domain/types";
import { createIdempotencyKey } from "../domain/rules";
import {
  recordAssessment,
  recordAttendance,
  recordLessonPlan,
  uploadAcademicDocument,
  type WorkspaceData,
} from "../lib/repository";

function readableError(reason: unknown) {
  if (reason instanceof Error && reason.message) return reason.message;
  if (
    reason &&
    typeof reason === "object" &&
    "message" in reason &&
    typeof reason.message === "string"
  ) {
    const item = reason as {
      message: string;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    return [
      item.message,
      item.details,
      item.hint ? "Hint: " + item.hint : null,
      item.code ? "Code: " + item.code : null,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return "Classroom command could not be completed. Check your assigned class and permissions.";
}
export default function ClassroomWorkspace({
  workspace,
  onRefresh,
}: {
  workspace: WorkspaceData;
  onRefresh: () => Promise<void>;
}) {
  const assigned = workspace.academics.assignments.filter(
      (item) =>
        item.status === "active" &&
        (!workspace.viewer.id || item.teacherUserId === workspace.viewer.id),
    ),
    periods = workspace.academics.timetable.filter(
      (item) =>
        item.status === "active" &&
        (!workspace.viewer.id ||
          assigned.some((assignment) => assignment.id === item.assignmentId)),
    ),
    classes = Array.from(new Set(assigned.map((item) => item.className))),
    [className, setClassName] = useState(classes[0] ?? ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const learners = workspace.learners.filter(
      (item) => item.className === className,
    ),
    subjects = assigned.filter((item) => item.className === className);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await onRefresh();
      setMessage(success);
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setBusy(false);
    }
  }
  async function submitAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget),
      marks = learners.map((learner) => ({
        studentId: learner.id,
        status: String(
          f.get(`status:${learner.id}`),
        ) as AttendanceCommand["marks"][number]["status"],
        note: String(f.get(`note:${learner.id}`) || ""),
      }));
    await run(
      () =>
        recordAttendance({
          className,
          sessionDate: String(f.get("date")),
          periodLabel: String(f.get("period")),
          marks,
          idempotencyKey: createIdempotencyKey("teacher-attendance"),
        }),
      `${marks.length} attendance records secured.`,
    );
  }
  async function submitAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget),
      maxScore = Number(f.get("maxScore")),
      marks = learners.map((learner) => ({
        studentId: learner.id,
        score: Number(f.get(`score:${learner.id}`)),
        comment: String(f.get(`comment:${learner.id}`) || ""),
      }));
    await run(
      () =>
        recordAssessment({
          subjectId: String(f.get("subjectId")),
          className,
          title: String(f.get("title")),
          assessmentType: String(f.get("assessmentType")) as "quiz"|"assignment"|"test"|"exam"|"mock"|"practical"|"project"|"oral"|"observation",
          durationMinutes: Number(f.get("durationMinutes")) || undefined,
          paperReference: String(f.get("paperReference") || ""),
          questionSummary: String(f.get("questionSummary") || ""),
          markingGuide: String(f.get("markingGuide") || ""),
          syllabusObjectives: String(f.get("syllabusObjectives") || ""),
          maxScore,
          assessmentDate: String(f.get("date")),
          marks,
          idempotencyKey: createIdempotencyKey("teacher-assessment"),
        }),
      `${marks.length} marks submitted with paper and objective evidence.`,
    );
  }
  async function submitLessonPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await run(
      () =>
        recordLessonPlan({
          assignmentId: String(f.get("assignmentId")),
          lessonDate: String(f.get("lessonDate")),
          title: String(f.get("lessonTitle")),
          objectives: String(f.get("objectives")),
          learningActivity: String(f.get("learningActivity")),
          evidence: String(f.get("lessonEvidence")),
          followUp: String(f.get("followUp") || ""),
          idempotencyKey: createIdempotencyKey("teacher-lesson-plan"),
        }),
      "Lesson plan recorded for pacing and academic review.",
    );
  }
  return (
    <div className="content">
      <section className="page-intro">
        <div>
          <span>TEACHER CLASSROOM</span>
          <h2>Today&apos;s teaching, attendance and learning evidence.</h2>
          <p>
            Only assigned classes and periods appear here. Submitted marks
            remain unpublished until an independent academic review.
          </p>
        </div>
        <div className="care-assurance">
          <ShieldCheck />
          <span>
            <strong>Teacher scope enforced</strong>
            <small>
              No access, enrolment, finance or credential administration.
            </small>
          </span>
        </div>
      </section>
      {error && <div className="form-status error">{error}</div>}
      {message && <div className="form-status success">{message}</div>}
      <section className="panel academic-register">
        <div className="panel-title">
          <CalendarClock />
          <div>
            <span>MY TIMETABLE</span>
            <h3>Assigned teaching periods</h3>
          </div>
        </div>
        {periods.length ? (
          periods.map((period) => (
            <article key={period.id}>
              <strong>
                {period.startsAt}â{period.endsAt}
              </strong>
              <span>
                {period.className} Â· {period.subjectName}
              </span>
              <small>{period.room || "Room not assigned"}</small>
            </article>
          ))
        ) : (
          <p>
            No active timetable period has been assigned to this teacher
            account.
          </p>
        )}
      </section>
      <label>
        Working class
        <select
          aria-label="Working class"
          value={className}
          onChange={(event) => setClassName(event.target.value)}
        >
          <option value="">Choose assigned class</option>
          {classes.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      {className && (
        <div className="transport-grid">
          <section className="panel">
            <div className="panel-title">
              <CalendarClock />
              <div>
                <span>LESSON PACING</span>
                <h3>Plan objectives and evidence</h3>
              </div>
            </div>
            <form className="settings-form" onSubmit={submitLessonPlan}>
              <div className="form-grid">
                <label>
                  Teaching assignment
                  <select name="assignmentId" defaultValue={subjects[0]?.id ?? ""} required>
                    <option value="">Choose assigned subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.subjectName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Lesson date
                  <input name="lessonDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                </label>
                <label>
                  Lesson title
                  <input name="lessonTitle" placeholder="Topic or sequence" required />
                </label>
                <label>
                  Objectives or competencies
                  <input name="objectives" placeholder="What learners should know or do" required />
                </label>
              </div>
              <label>
                Learner activity and teaching approach
                <textarea name="learningActivity" rows={3} placeholder="Investigation, practice, group work, demonstration..." required />
              </label>
              <label>
                Evidence to collect
                <input name="lessonEvidence" placeholder="Exit ticket, exercise, observation, workbook scan..." required />
              </label>
              <label>
                Follow-up or differentiation
                <input name="followUp" placeholder="Support, extension or next lesson adjustment" />
              </label>
              <button className="primary" disabled={busy || !subjects.length}>
                Record lesson plan
              </button>
            </form>
          </section>
          <section className="panel">
            <div className="panel-title">
              <ClipboardCheck />
              <div>
                <span>ATTENDANCE</span>
                <h3>Capture this class once</h3>
              </div>
            </div>
            <form className="settings-form" onSubmit={submitAttendance}>
              <div className="form-grid">
                <label>
                  Date
                  <input
                    name="date"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </label>
                <label>
                  Period
                  <select name="period">
                    <option value="AM">Morning</option>
                    <option value="PM">Afternoon</option>
                    <option value="EXTRA">Extra class</option>
                  </select>
                </label>
              </div>
              <Rows learners={learners} kind="attendance" />
              <button className="primary" disabled={busy || !learners.length}>
                Submit attendance evidence
              </button>
            </form>
          </section>
          <section className="panel">
            <div className="panel-title">
              <BookOpenCheck />
              <div>
                <span>ASSESSMENT</span>
                <h3>Set paper, questions and marks</h3>
              </div>
            </div>
            <form className="settings-form" onSubmit={submitAssessment}>
              <div className="form-grid">
                <label>
                  Subject
                  <select name="subjectId" required>
                    <option value="">Choose assigned subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.subjectId}>
                        {subject.subjectName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Assessment type
                  <select name="assessmentType"><option value="quiz">Quiz</option><option value="assignment">Assignment</option><option value="test">Test</option><option value="exam">Exam</option><option value="mock">Mock exam</option><option value="practical">Practical</option><option value="project">Project</option><option value="oral">Oral</option><option value="observation">Observation</option></select>
                </label>
                <label>
                  Assessment title
                  <input
                    name="title"
                    placeholder="Sequence 1 test, quiz, mock exam..."
                    required
                  />
                </label>
                <label>
                  Date
                  <input
                    name="date"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    required
                  />
                </label>
                <label>
                  Duration in minutes
                  <input name="durationMinutes" type="number" min="1" max="600" />
                </label>
                <label>
                  Maximum score
                  <input
                    name="maxScore"
                    type="number"
                    min="1"
                    defaultValue="20"
                    required
                  />
                </label>
                <label>
                  Paper or scan reference
                  <input
                    name="paperReference"
                    placeholder="PDF, worksheet, notebook page or exam paper ref"
                  />
                </label>
                <label>
                  Syllabus objectives covered
                  <input
                    name="syllabusObjectives"
                    placeholder="Objectives, competencies or lesson outcomes"
                  />
                </label>
              </div>
              <label>
                Questions or task scope
                <textarea
                  name="questionSummary"
                  rows={3}
                  placeholder="List question numbers, skills tested or the task pupils completed."
                />
              </label>
              <label>
                Marking guide or expected answers
                <textarea
                  name="markingGuide"
                  rows={3}
                  placeholder="Rubric, answer key, moderation note or scoring method."
                />
              </label>
              <Rows learners={learners} kind="assessment" />
              <button className="primary" disabled={busy || !learners.length}>
                Submit assessment for independent review
              </button>
            </form>
          </section>
        </div>
      )}
      {className&&<AcademicLibrary workspace={workspace} subjects={subjects} busy={busy} run={run}/>} 
    </div>
  );
}
function AcademicLibrary({workspace,subjects,busy,run}:{workspace:WorkspaceData;subjects:WorkspaceData["academics"]["assignments"];busy:boolean;run:(action:()=>Promise<unknown>,success:string)=>Promise<void>}){
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget),file=form.get("file");if(!(file instanceof File)||!file.size)throw new Error("Choose a document to upload.");await run(()=>uploadAcademicDocument({file,title:String(form.get("documentTitle")),documentType:String(form.get("documentType")) as "syllabus"|"assessment_paper"|"marking_guide"|"past_paper"|"lesson_resource",language:String(form.get("language")) as "english"|"french"|"bilingual"|"other",subjectId:String(form.get("documentSubjectId"))}),"Academic document uploaded to the protected school library.")}
  return <section className="panel"><div className="panel-title"><BookOpenCheck/><div><span>PROTECTED ACADEMIC LIBRARY</span><h3>Upload syllabuses, exam papers and resources</h3></div></div><p>PDF, Word and scans remain private to authorized staff. Maximum 15 MB.</p><form className="settings-form" onSubmit={submit}><div className="form-grid"><label>Document title<input name="documentTitle" required/></label><label>Document type<select name="documentType"><option value="syllabus">Syllabus</option><option value="assessment_paper">Assessment paper</option><option value="marking_guide">Marking guide</option><option value="past_paper">Past paper</option><option value="lesson_resource">Lesson resource</option></select></label><label>Language<select name="language"><option value="bilingual">Bilingual</option><option value="english">English</option><option value="french">French</option><option value="other">Other</option></select></label><label>Subject<select name="documentSubjectId" required><option value="">Choose assigned subject</option>{subjects.map(subject=><option key={subject.id} value={subject.subjectId}>{subject.subjectName}</option>)}</select></label><label>Choose PDF, Word or scan<input aria-label="Choose academic file" name="file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" required/></label></div><button className="primary" disabled={busy||!subjects.length}>Upload protected document</button></form>{workspace.academics.documents.slice(0,8).map(document=><article className="document-row" key={document.id}><strong>{document.title}</strong><span>{document.documentType.replaceAll("_"," ")} Â· {document.language} Â· {Math.ceil(document.fileSize/1024)} KB</span><small>{document.status}</small></article>)}</section>
}
function Rows({
  learners,
  kind,
}: {
  learners: WorkspaceData["learners"];
  kind: "attendance" | "assessment";
}) {
  return (
    <div className="compact-table">
      {learners.map((learner) => (
        <label key={learner.id}>
          {learner.name}
          {kind === "attendance" ? (
            <>
              <select name={`status:${learner.id}`} defaultValue="present">
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="excused">Excused</option>
              </select>
              <input name={`note:${learner.id}`} placeholder="Optional note" />
            </>
          ) : (
            <>
              <input
                name={`score:${learner.id}`}
                type="number"
                min="0"
                step="0.5"
                required
              />
              <input
                name={`comment:${learner.id}`}
                placeholder="Evidence comment"
              />
            </>
          )}
        </label>
      ))}
    </div>
  );
}
