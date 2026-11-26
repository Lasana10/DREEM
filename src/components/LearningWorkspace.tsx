import {
  BookOpenCheck,
  ClipboardCheck,
  FileUp,
  ShieldCheck,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { createIdempotencyKey } from "../domain/rules";
import { canAuthority } from "../lib/access";
import { schoolClock } from "../lib/academicWeek";
import { assignmentBelongsToLearner, assignmentsForLinkedLearners, curriculumForTeachingAssignment, teachingAssignmentsForAuthor } from "../lib/learningContext";
import {
  createAssignment,
  gradeAssignmentSubmission,
  publishAssignment,
  submitAssignment,
  type WorkspaceData,
} from "../lib/repository";

function errorText(reason: unknown) {
  return reason instanceof Error
    ? reason.message
    : "The learning command could not be completed.";
}
function explainInvalid(form: HTMLFormElement) {
  const field = form.querySelector<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >(":invalid");
  if (!field) return "Complete all required assignment fields.";
  field.focus();
  field.scrollIntoView({ behavior: "smooth", block: "center" });
  const label =
    field.closest("label")?.childNodes[0]?.textContent?.trim() ||
    field.name ||
    "field";
  return `Complete “${label}” before saving the assignment.`;
}

export default function LearningWorkspace({
  workspace,
  onRefresh,
}: {
  workspace: WorkspaceData;
  onRefresh: () => Promise<void>;
}) {
  const role = workspace.viewer.role,
    canCreate = canAuthority(workspace.viewer,"academics_delivery"),
    canReview = canAuthority(workspace.viewer,"academics_approval") || canAuthority(workspace.viewer,"academics_delivery"),
    family = role === "student" || role === "parent",
    canSubmit = family;
  const [selectedTeachingAssignment,setSelectedTeachingAssignment]=useState("");
  const [selectedFamilyAssignment,setSelectedFamilyAssignment]=useState("");
  const academicReviewer=canAuthority(workspace.viewer,"academics_approval");
  const teachingAssignments=teachingAssignmentsForAuthor(workspace.academics.assignments,workspace.viewer.id,academicReviewer);
  const teachingAssignment=teachingAssignments.find(x=>x.id===selectedTeachingAssignment);
  const curriculumOutcomes=curriculumForTeachingAssignment(workspace.academics.curriculumOutcomes,teachingAssignment);
  const teacherAssignmentIds=new Set(teachingAssignments.map(x=>x.id));
  const visibleWork=family?assignmentsForLinkedLearners(workspace.academics.assignmentsForLearners,workspace.learners):academicReviewer?workspace.academics.assignmentsForLearners:workspace.academics.assignmentsForLearners.filter(x=>teacherAssignmentIds.has(x.teachingAssignmentId));
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
      await onRefresh();
      setMessage(success);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      setMessage("");
      setError(explainInvalid(form));
      return;
    }
    const f = new FormData(form),
      outcomes = f.getAll("outcomes").map(String);
    const assignmentId=String(f.get("teachingAssignmentId"));
    if(!teachingAssignments.some(a=>a.id===assignmentId)){setError("Choose an active class and subject assigned to you.");return;}
    const allowed=new Set(curriculumForTeachingAssignment(workspace.academics.curriculumOutcomes,teachingAssignments.find(a=>a.id===assignmentId)).map(o=>o.id));
    if(outcomes.some(id=>!allowed.has(id))){setError("Curriculum objectives must belong to the chosen class, subject and year.");return;}
    await run(async () => {
      await createAssignment({
        teachingAssignmentId: assignmentId,
        title: String(f.get("title")),
        instructions: String(f.get("instructions")),
        assignedOn: String(f.get("assignedOn")),
        dueAt: new Date(String(f.get("dueAt"))).toISOString(),
        maxScore: Number(f.get("maxScore")),
        submissionMode: String(f.get("submissionMode")) as
          "text" | "file" | "text_or_file" | "offline",
        outcomeIds: outcomes,
        idempotencyKey: createIdempotencyKey("assignment"),
      });
      form.reset();
    }, "Assignment draft saved. It is now listed under Release work to learners.");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget),
      file = f.get("file");
    const chosenAssignment=visibleWork.find(a=>a.id===String(f.get("assignmentId")));
    const chosenLearner=workspace.learners.find(l=>l.id===String(f.get("studentId")));
    if(!chosenAssignment||!chosenLearner||!assignmentBelongsToLearner(chosenAssignment,chosenLearner)){setError("Choose published work for the selected learner’s class. No work was submitted.");return;}
    await run(
      () =>
        submitAssignment({
          assignmentId: String(f.get("assignmentId")),
          studentId: String(f.get("studentId")),
          responseText: String(f.get("responseText") || ""),
          file: file instanceof File && file.size ? file : undefined,
        }),
      "Work submitted with a protected timestamp.",
    );
  }
  async function grade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget),
      decision = String(f.get("decision")) as "graded" | "needs_revision";
    await run(
      () =>
        gradeAssignmentSubmission({
          submissionId: String(f.get("submissionId")),
          score: decision === "graded" ? Number(f.get("score")) : undefined,
          feedback: String(f.get("feedback")),
          decision,
          idempotencyKey: createIdempotencyKey("assignment-grade"),
        }),
      decision === "graded"
        ? "Grade and feedback recorded."
        : "Work returned for revision.",
    );
  }
  const drafts = visibleWork.filter(
      (x) => x.status === "draft",
    ),
    open = visibleWork.filter(
      (x) => x.status === "published",
    ),
    workIds=new Set(visibleWork.map(a=>a.id)),
    pending = workspace.academics.assignmentSubmissions.filter(
      (x) => workIds.has(x.assignmentId)&&(x.status === "submitted" || x.status === "late"),
    );
  return (
    <div className="content">
      <section className="role-hero"><div><span className="eyebrow">LEARNING WORKSPACE</span><h2>Set work, review submissions and give feedback</h2><p>Class, subject, deadline and learner evidence stay connected automatically.</p></div><div className="role-hero-status"><span className="status-pill info"><ShieldCheck size={14}/> Protected evidence</span></div></section>
      {error && (
        <div className="form-status error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}
      {message && (
        <div className="form-status success" role="status" aria-live="polite">
          {message}
        </div>
      )}
      {canCreate && (
        <div className="academic-grid">
          <section className="panel">
            <Title
              icon={<BookOpenCheck />}
              label="TEACHER AUTHORING"
              title="Create assignment"
            />
            <form className="settings-form" onSubmit={create} noValidate>
              <label>
                Teaching assignment
                <select name="teachingAssignmentId" required value={selectedTeachingAssignment} onChange={e=>setSelectedTeachingAssignment(e.target.value)}>
                  <option value="">Choose assigned class and subject</option>
                  {teachingAssignments
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.className} · {x.subjectName}
                      </option>
                    ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Title
                  <input name="title" required />
                </label>
                <label>
                  Assigned on
                  <input
                    name="assignedOn"
                    type="date"
                    required
                    defaultValue={schoolClock(new Date(),workspace.brand.timezone||"Africa/Douala").date}
                  />
                </label>
                <label>
                  Due date and time
                  <input name="dueAt" type="datetime-local" required />
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
                  Submission mode
                  <select name="submissionMode">
                    <option value="text_or_file">Text or file</option>
                    <option value="text">Text only</option>
                    <option value="file">File only</option>
                    <option value="offline">Offline/paper</option>
                  </select>
                </label>
              </div>
              <label>
                Instructions{" "}
                <small>Required—describe exactly what learners must do.</small>
              <textarea
                aria-label="Instructions"
                name="instructions"
                required
                minLength={5}
              />
              </label>
              <label>
                Curriculum outcomes{" "}
                <small>Optional—select one or more syllabus objectives.</small>
              <select aria-label="Curriculum outcomes" name="outcomes" multiple size={4}>
                  {curriculumOutcomes
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} · {x.titleEn}
                        {x.titleFr ? ` / ${x.titleFr}` : ""}
                      </option>
                    ))}
                </select>
              </label>
              <div className="mobile-submit-bar">
                <button className="primary" disabled={busy}>
                  {busy ? "Saving assignment…" : "Create assignment draft"}
                </button>
              </div>
            </form>
          </section>
          <section className="panel">
            <Title
              icon={<ClipboardCheck />}
              label="PUBLICATION CONTROL"
              title="Release work to learners"
            />
            {drafts.map((x) => (
              <article className="document-row" key={x.id}>
                <strong>{x.title}</strong>
                <span>
                  {x.className} · {x.subjectName} · due{" "}
                  {new Date(x.dueAt).toLocaleString()}
                </span>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        publishAssignment(
                          x.id,
                          createIdempotencyKey("assignment-publish"),
                        ),
                      "Assignment published to the class.",
                    )
                  }
                >
                  Publish assignment
                </button>
              </article>
            ))}
            {!drafts.length && (
              <p>No assignment drafts are awaiting publication.</p>
            )}
          </section>
        </div>
      )}
      <div className="academic-grid">
        <section className="panel">
          <Title
            icon={<FileUp />}
            label={family ? "MY ASSIGNMENTS" : "LEARNER DELIVERY"}
            title="Submit work and evidence"
          />
          {open.map((x) => (
            <article className="document-row" key={x.id}>
              <strong>{x.title}</strong>
              <span>
                {x.subjectName} · due {new Date(x.dueAt).toLocaleString()} ·{" "}
                {x.maxScore} marks
              </span>
              <small>{x.instructions}</small>
            </article>
          ))}
          {canSubmit && (
            <form className="settings-form" onSubmit={submit}>
              <label>
                Assignment
                <select name="assignmentId" required value={selectedFamilyAssignment} onChange={e=>setSelectedFamilyAssignment(e.target.value)}>
                  <option value="">Choose open assignment</option>
                  {open.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title} · {x.subjectName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Learner
                <select name="studentId" required>
                  <option value="">Choose learner</option>
                  {workspace.learners.filter(learner=>open.some(item=>item.id===selectedFamilyAssignment&&assignmentBelongsToLearner(item,learner))).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} · {x.className}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Written response
                <textarea name="responseText" rows={5} />
              </label>
              <label>
                Evidence file
                <input
                  aria-label="Assignment evidence file"
                  name="file"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                />
              </label>
              <button
                className="primary"
                disabled={busy || !selectedFamilyAssignment || !workspace.learners.some(learner=>open.some(item=>item.id===selectedFamilyAssignment&&assignmentBelongsToLearner(item,learner)))}
              >
                Submit assignment
              </button>
            </form>
          )}
        </section>
        {canReview && !family && (
          <section className="panel">
            <Title
              icon={<ClipboardCheck />}
              label="FEEDBACK"
              title="Grade or return submissions"
            />
            <form className="settings-form" onSubmit={grade}>
              <label>
                Submission
                <select name="submissionId" required>
                  <option value="">Choose submitted work</option>
                  {pending.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.studentName} · attempt {x.attempt} · {x.status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  Decision
                  <select name="decision">
                    <option value="graded">Grade</option>
                    <option value="needs_revision">Return for revision</option>
                  </select>
                </label>
                <label>
                  Score
                  <input name="score" type="number" min="0" step="0.5" />
                </label>
              </div>
              <label>
                Feedback
                <textarea name="feedback" required minLength={3} />
              </label>
              <button className="primary" disabled={busy || !pending.length}>
                Record feedback
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
function Title({
  icon,
  label,
  title,
}: {
  icon: ReactNode;
  label: string;
  title: string;
}) {
  return (
    <div className="panel-title">
      {icon}
      <div>
        <span>{label}</span>
        <h3>{title}</h3>
      </div>
    </div>
  );
}
