import { useState, type FormEvent } from "react";
import { submitAssignment, type WorkspaceData } from "../lib/repository";
import "./StudentWorkspace.css";

const tabs = ["Today", "Classes", "Work", "Results"] as const;
type Tab = typeof tabs[number];

export default function StudentWorkspace({ workspace, onRefresh }: { workspace: WorkspaceData; onRefresh: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>("Today");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  // The repository must return the single learner linked to this student account.
  const learner = workspace.learners.length === 1 ? workspace.learners[0] : undefined;
  if (!learner) return <div className="content"><section className="panel"><h2>Learner access needs attention</h2><p>The school must link this account to one learner before opening the Student app.</p></section></div>;
  const work = workspace.academics.assignmentsForLearners.filter(item => item.className === learner.className && item.status === "published");
  const submissions = workspace.academics.assignmentSubmissions.filter(item => item.studentId === learner.id);
  const completed = new Set(submissions.filter(item => item.status !== "needs_revision").map(item => item.assignmentId));
  const due = work.filter(item => !completed.has(item.id)).sort((a,b) => a.dueAt.localeCompare(b.dueAt));
  const periods = workspace.academics.timetable.filter(item => item.status === "active" && item.className === learner.className);
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: workspace.brand.timezone || "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => dateParts.find(item => item.type === type)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
  const todayPeriods = periods.filter(item => item.weekday === weekday && item.effectiveFrom <= today && item.effectiveTo >= today).sort((a,b) => a.startsAt.localeCompare(b.startsAt));
  const reports = workspace.academics.reportCards.filter(item => item.studentId === learner.id && item.status === "published");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !learner) return;
    const form = event.currentTarget, data = new FormData(form);
    const assignment = work.find(item => item.id === data.get("assignmentId"));
    const fileValue = data.get("file"), file = fileValue instanceof File && fileValue.size ? fileValue : undefined;
    const responseText = String(data.get("responseText") || "").trim();
    setError(""); setMessage("");
    if (!assignment) { setError("Choose a published assignment."); return; }
    if (assignment.submissionMode === "offline") { setError("Hand this work to your teacher; it is configured for classroom submission."); return; }
    if ((assignment.submissionMode === "text" && !responseText) || (assignment.submissionMode === "file" && !file) || (assignment.submissionMode === "text_or_file" && !file && !responseText)) { setError("Add the written response or file required by this assignment."); return; }
    setBusy(true);
    try {
      await submitAssignment({ assignmentId: assignment.id, studentId: learner.id, responseText, file });
      form.reset();
      setMessage("Your work was saved by the school.");
      try { await onRefresh(); } catch { setError("Your work was saved, but the list could not refresh. Refresh the page to see it."); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Submission failed. Your entered work has been kept; try again."); }
    finally { setBusy(false); }
  }

  return <div className="content student-workspace">
    <section className="page-intro"><div><span>DREEM STUDENT</span><h2>Hello, {learner.name}</h2><p>{learner.className} · {learner.matricule}</p></div></section>
    <nav aria-label="Student workspace">{tabs.map(item => <button key={item} className={tab === item ? "primary" : ""} aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {error && <p className="form-status error" role="alert">{error}</p>}{message && <p className="form-status success" role="status">{message}</p>}
    {tab === "Today" && <section className="panel"><h3>Your school day · {today}</h3>{todayPeriods.map(item => <article className="document-row" key={item.id}><strong>{item.subjectName}</strong><span>{item.startsAt}–{item.endsAt} · {item.room || "Room to be confirmed"}</span></article>)}{!todayPeriods.length && <p>No scheduled lessons today.</p>}<h3>{due.length} assignment(s) awaiting your work</h3>{due.slice(0,5).map(item => <article className="document-row" key={item.id}><strong>{item.title}</strong><span>Due {new Date(item.dueAt).toLocaleString()}</span></article>)}<button onClick={() => setTab("Work")}>Open my work</button></section>}
    {tab === "Classes" && <section className="panel"><h3>My timetable</h3>{[...periods].sort((a,b) => a.weekday-b.weekday || a.startsAt.localeCompare(b.startsAt)).map(item => <article className="document-row" key={item.id}><strong>{item.subjectName}</strong><span>{["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][item.weekday]} · {item.startsAt}–{item.endsAt}</span><small>{item.teacherName} · {item.room || "Room to be confirmed"}</small></article>)}{!periods.length && <p>Your school has not published a timetable for your class.</p>}</section>}
    {tab === "Work" && <section className="panel"><h3>Assignments and instructions</h3>{work.map(item => <article className="document-row" key={item.id}><strong>{item.title} · {item.subjectName}</strong><p>{item.instructions}</p><span>Due {new Date(item.dueAt).toLocaleString()} · {item.maxScore} marks · {item.submissionMode.replaceAll("_", " ")}</span></article>)}{!work.length && <p>No published assignments yet.</p>}<form className="settings-form" onSubmit={submit}><label>Assignment<select name="assignmentId" required disabled={busy}><option value="">Choose assignment</option>{work.filter(item => item.submissionMode !== "offline").map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label>Written response<textarea name="responseText" rows={5} disabled={busy}/></label><label>Evidence file<input name="file" type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp" disabled={busy}/></label><button className="primary" disabled={busy || !work.some(item => item.submissionMode !== "offline")}>{busy ? "Submitting…" : "Submit work"}</button></form><h3>Submission history</h3>{submissions.map(item => <article className="document-row" key={item.id}><strong>{work.find(a => a.id === item.assignmentId)?.title || "Assignment"}</strong><span>Attempt {item.attempt} · {item.status.replaceAll("_", " ")}</span><small>{item.feedback}</small></article>)}</section>}
    {tab === "Results" && <section className="panel"><h3>Teacher feedback</h3>{submissions.filter(item => item.status === "graded" || item.feedback).map(item => <article className="document-row" key={item.id}><strong>{work.find(a => a.id === item.assignmentId)?.title || "Assignment feedback"}</strong><span>{item.score === undefined ? "Awaiting grade" : `${item.score} marks`}</span><p>{item.feedback}</p></article>)}<h3>Published report cards</h3>{reports.map(item => <article className="document-row" key={item.id}><strong>{item.termName}</strong><span>{item.overallAverage === undefined ? "Average unavailable" : `Average ${item.overallAverage}`} · revision {item.revision}</span></article>)}{!reports.length && <p>No official report card has been published yet.</p>}</section>}
  </div>;
}
