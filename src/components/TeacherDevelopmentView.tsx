import { BookOpenCheck, ShieldCheck, UserRoundCheck } from "lucide-react";
import type { TeacherSummary } from "../domain/types";

export default function TeacherDevelopmentView({ teachers }:{ teachers:TeacherSummary[] }) {
  const balanced = teachers.filter(item => item.workload === "balanced").length;
  const support = teachers.filter(item => item.nextSupport && item.nextSupport.trim().length > 0);
  return <div className="content">
    <section className="role-hero"><div><span className="eyebrow">TEACHING TEAM</span><h2>{teachers.length} teacher{teachers.length===1?"":"s"} in view</h2><p>Use recorded teaching evidence to support workload, coaching and follow-up—not automatic disciplinary decisions.</p></div><div className="role-hero-status"><span className="status-pill info"><ShieldCheck size={14}/> Coaching evidence</span></div></section>

    <div className="metrics">
      <article className="metric"><span>Teachers visible</span><strong>{teachers.length}</strong><small>Authorized staff evidence only</small></article>
      <article className="metric blue"><span>Balanced workload</span><strong>{balanced}</strong><small>Based on recorded workload status</small></article>
      <article className="metric amber"><span>Support actions</span><strong>{support.length}</strong><small>Recorded next-support items</small></article>
    </div>

    <section className="panel">
      <div className="panel-title"><BookOpenCheck/><div><span>TEACHING EVIDENCE</span><h3>Teacher development register</h3></div></div>
      {teachers.length === 0 ? <p>No teacher evidence is available yet. Assign teaching ownership and record classroom evidence first.</p> : teachers.map(teacher => <article className="document-row" key={teacher.id}>
        <div><strong>{teacher.name}</strong><small>{teacher.subject || "Subject not assigned"}</small></div>
        <div><span>Learner growth</span><strong>{teacher.learnerGrowth >= 0 ? "+" : ""}{teacher.learnerGrowth}%</strong></div>
        <div><span>Coverage / mastery</span><strong>{teacher.coverage}% / {teacher.mastery}%</strong></div>
        <div><span>Workload</span><strong>{teacher.workload}</strong></div>
        <div><span>Next support</span><strong>{teacher.nextSupport || "No support action recorded"}</strong></div>
      </article>)}
    </section>

    <details className="depth-drawer"><summary>How teacher development evidence is handled</summary><section className="panel"><div className="panel-title"><UserRoundCheck/><div><span>DEVELOPMENT FLOW</span><h3>Evidence → review → support → follow-up</h3></div></div><p>DREEM preserves the history and context. Consequential staff decisions remain human-controlled.</p></section></details>
  </div>;
}
