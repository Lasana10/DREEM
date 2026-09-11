import { BookOpenCheck, ShieldCheck, UserRoundCheck } from "lucide-react";
import type { TeacherSummary } from "../domain/types";

export default function TeacherDevelopmentView({ teachers }:{ teachers:TeacherSummary[] }) {
  const balanced = teachers.filter(item => item.workload === "balanced").length;
  const support = teachers.filter(item => item.nextSupport && item.nextSupport.trim().length > 0);
  return <div className="content">
    <section className="page-intro">
      <div>
        <span>TEACHING & STAFF DEVELOPMENT</span>
        <h2>Support teachers from verified school evidence.</h2>
        <p>This leadership view summarizes teaching evidence already recorded in DREEM. It does not invent performance claims or make disciplinary decisions.</p>
      </div>
      <div className="care-assurance"><ShieldCheck/><span><strong>Coaching, not surveillance</strong><small>Context, workload and learner evidence stay distinguishable.</small></span></div>
    </section>

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

    <section className="panel">
      <div className="panel-title"><UserRoundCheck/><div><span>SAFE DEVELOPMENT CYCLE</span><h3>Evidence → review → support → follow-up</h3></div></div>
      <p>1. Record teaching ownership and classroom evidence. 2. Review the evidence with context. 3. Agree a support action where needed. 4. Follow up with new evidence. DREEM preserves the history; consequential staff decisions remain human-controlled.</p>
    </section>
  </div>;
}
