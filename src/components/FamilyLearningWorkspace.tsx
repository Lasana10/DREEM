import { BookOpenCheck, FileCheck2, GraduationCap, ShieldCheck } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { submitAssignment, type WorkspaceData } from "../lib/repository";

function messageFrom(reason: unknown) {
  return reason instanceof Error ? reason.message : "The learning action could not be completed.";
}

export default function FamilyLearningWorkspace({ workspace, onRefresh }: { workspace: WorkspaceData; onRefresh: () => Promise<void> }) {
  const guardian = workspace.viewer.role === "parent";
  const [selectedStudentId, setSelectedStudentId] = useState(workspace.learners[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const learner = workspace.learners.find((item) => item.id === selectedStudentId) ?? workspace.learners[0];
  const learnerId = learner?.id ?? "";
  const learnerClass = learner?.className ?? "";
  const assignments = useMemo(
    () => workspace.academics.assignmentsForLearners.filter((item) => item.status === "published" && (!learnerClass || item.className === learnerClass)),
    [workspace.academics.assignmentsForLearners, learnerClass],
  );
  const submissions = workspace.academics.assignmentSubmissions.filter((item) => item.studentId === learnerId);
  const reportCards = workspace.academics.reportCards.filter((item) => item.studentId === learnerId && item.status === "published");
  const submittedAssignmentIds = new Set(submissions.filter((item) => item.status !== "needs_revision").map((item) => item.assignmentId));
  const due = assignments.filter((item) => !submittedAssignmentIds.has(item.id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await submitAssignment({
        assignmentId: String(data.get("assignmentId")),
        studentId: learnerId,
        responseText: String(data.get("responseText") || ""),
        file: file instanceof File && file.size ? file : undefined,
      });
      form.reset();
      await onRefresh();
      setMessage("Work submitted and timestamped in the learner record.");
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!learner) {
    return <div className="content"><section className="panel"><h2>No linked learner</h2><p>This account does not currently have a learner record it is authorised to view.</p></section></div>;
  }

  return (
    <div className="content">
      <section className="page-intro">
        <div>
          <span>{guardian ? "GUARDIAN APP" : "STUDENT APP"}</span>
          <h2>{guardian ? "Follow learning without entering the teacher workspace." : "Your work, feedback and published results in one place."}</h2>
          <p>{guardian ? "Only linked children and their authorised learning records appear here." : "Only assignments and results released to your learner record appear here."}</p>
        </div>
        <div className="care-assurance"><ShieldCheck /><span><strong>Private learner view</strong><small>School administration and other learners remain outside this workspace.</small></span></div>
      </section>

      {guardian && workspace.learners.length > 1 ? <label>Child<select value={learnerId} onChange={(event) => setSelectedStudentId(event.target.value)}>{workspace.learners.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.className}</option>)}</select></label> : null}
      {error ? <div className="form-status error" role="alert">{error}</div> : null}
      {message ? <div className="form-status success" role="status">{message}</div> : null}

      <section className="metrics">
        <article className="metric"><span>Due work</span><strong>{due.length}</strong><small>{learner.name}</small></article>
        <article className="metric blue"><span>Submitted</span><strong>{submissions.filter((item) => ["submitted","late"].includes(item.status)).length}</strong><small>Awaiting teacher action</small></article>
        <article className="metric amber"><span>Feedback</span><strong>{submissions.filter((item) => ["graded","needs_revision"].includes(item.status)).length}</strong><small>Returned or graded</small></article>
        <article className="metric"><span>Published reports</span><strong>{reportCards.length}</strong><small>Official school results</small></article>
      </section>

      <div className="academic-grid">
        <section className="panel">
          <div className="panel-title"><BookOpenCheck /><div><span>ASSIGNMENTS</span><h3>Work released to {learner.name}</h3></div></div>
          {assignments.map((item) => <article className="document-row" key={item.id}><strong>{item.title}</strong><span>{item.subjectName} · due {new Date(item.dueAt).toLocaleString()}</span><small>{item.instructions}</small></article>)}
          {!assignments.length ? <p>No published assignments are currently visible for this learner.</p> : null}
        </section>

        <section className="panel">
          <div className="panel-title"><FileCheck2 /><div><span>SUBMIT WORK</span><h3>Send learner evidence</h3></div></div>
          <form className="settings-form" onSubmit={submit}>
            <label>Assignment<select name="assignmentId" required><option value="">Choose open assignment</option>{assignments.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.subjectName}</option>)}</select></label>
            <label>Written response<textarea name="responseText" rows={5} /></label>
            <label>Evidence file<input name="file" type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp" /></label>
            <button className="primary" disabled={busy || !assignments.length}>{busy ? "Submitting…" : "Submit work"}</button>
          </form>
        </section>
      </div>

      <div className="academic-grid">
        <section className="panel">
          <div className="panel-title"><GraduationCap /><div><span>TEACHER FEEDBACK</span><h3>Submission history</h3></div></div>
          {submissions.map((item) => <article className="document-row" key={item.id}><strong>{item.studentName} · attempt {item.attempt}</strong><span>{item.status.replaceAll("_", " ")}{typeof item.score === "number" ? ` · ${item.score} marks` : ""}</span>{item.feedback ? <small>{item.feedback}</small> : null}</article>)}
          {!submissions.length ? <p>No assignment submissions have been recorded yet.</p> : null}
        </section>
        <section className="panel">
          <div className="panel-title"><FileCheck2 /><div><span>OFFICIAL RESULTS</span><h3>Published report cards</h3></div></div>
          {reportCards.map((item) => <article className="document-row" key={item.id}><strong>{item.termName}</strong><span>{typeof item.overallAverage === "number" ? `Average ${item.overallAverage}` : "Average pending"} · revision {item.revision}</span><small>{item.evidenceCount} published assessment evidence item(s)</small></article>)}
          {!reportCards.length ? <p>No published report card is available yet.</p> : null}
        </section>
      </div>
    </div>
  );
}
