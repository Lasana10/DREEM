import { BookOpenCheck, CalendarClock, ClipboardCheck, FolderHeart, GraduationCap, UsersRound } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import type { ViewKey } from "./Shell";

function minutes(value:string) { const [h,m] = value.slice(0,5).split(":").map(Number); return h*60+m; }

export default function TeacherHome({ workspace, onNavigate }:{ workspace:WorkspaceData; onNavigate:(view:ViewKey)=>void }) {
  const teacherId = workspace.viewer.id;
  const mine = workspace.academics.assignments.filter(item => item.status === "active" && !!teacherId && item.teacherUserId === teacherId);
  const mineIds = new Set(mine.map(item => item.id));
  const periods = workspace.academics.timetable.filter(item => item.status === "active" && mineIds.has(item.assignmentId));
  const classes = Array.from(new Set(mine.map(item => item.className)));
  const learnerIds = new Set(workspace.learners.filter(l => classes.includes(l.className)).map(l => l.id));
  const learnerAssignments = workspace.academics.assignmentsForLearners.filter(item => mineIds.has(item.teachingAssignmentId));
  const assignmentIds = new Set(learnerAssignments.map(item => item.id));
  const pending = workspace.academics.assignmentSubmissions.filter(item => assignmentIds.has(item.assignmentId) && (item.status === "submitted" || item.status === "late") && learnerIds.has(item.studentId));
  const drafts = learnerAssignments.filter(item => item.status === "draft");
  const published = learnerAssignments.filter(item => item.status === "published");
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const weekday = now.getDay() === 0 ? 7 : now.getDay();
  const currentMinutes = now.getHours()*60+now.getMinutes();
  const todayPeriods = periods.filter(item => item.weekday === weekday && item.effectiveFrom <= today && item.effectiveTo >= today).sort((a,b)=>minutes(a.startsAt)-minutes(b.startsAt));
  const next = todayPeriods.find(item => minutes(item.endsAt) >= currentMinutes);

  return <div className="content teacher-home role-workspace">
    <section className="page-intro"><div><span>DREEM TEACHER · TODAY</span><h2>Teach the day. Capture the evidence. Follow up what matters.</h2><p>Your classes, attendance, lesson evidence, coursework, marking and learner support stay together instead of being spread across separate registers.</p></div><div className="care-assurance"><CalendarClock/><span><strong>{today}</strong><small>{todayPeriods.length} teaching period{todayPeriods.length===1?"":"s"} today</small></span></div></section>

    <div className="teacher-action-grid">
      <article className="role-action primary-action"><CalendarClock/><span>NEXT CLASS</span><h3>{next ? `${next.className} · ${next.subjectName}` : "No remaining scheduled class"}</h3><p>{next ? `${next.startsAt}–${next.endsAt} · ${next.room || "Room not assigned"}` : "Your timetable has no remaining active period today."}</p><button className="primary" onClick={()=>onNavigate("operations")}>{next ? "Open class & take attendance" : "Open my classes"}</button></article>
      <article className="role-action"><ClipboardCheck/><span>MARKING</span><h3>{pending.length} submission{pending.length===1?"":"s"} waiting</h3><p>{drafts.length} draft assignment{drafts.length===1?"":"s"}; {published.length} currently published.</p><button onClick={()=>onNavigate("learning")}>Open assignments & marking</button></article>
      <article className="role-action"><UsersRound/><span>MY LEARNERS</span><h3>{learnerIds.size} learners in assigned classes</h3><p>Open only the learner context permitted for your teaching assignments.</p><button onClick={()=>onNavigate("learners")}>Open learner support</button></article>
    </div>

    <section className="panel lifecycle-panel"><div className="panel-title"><BookOpenCheck/><div><span>TEACHING CYCLE</span><h3>Plan → teach → attendance → work → assess → support</h3></div></div><div className="lifecycle-rail" aria-label="Teacher working cycle"><span className="active"><b>1</b>Prepare lesson</span><span><b>2</b>Teach class</span><span><b>3</b>Record attendance</span><span><b>4</b>Set / review work</span><span><b>5</b>Assess learning</span><span><b>6</b>Follow up learner</span></div><p className="lifecycle-note">Use <strong>My classes</strong> for lesson and attendance evidence, <strong>Assignments</strong> for coursework and marking, and <strong>Learner support</strong> when a learner needs follow-up.</p></section>

    <div className="dashboard-grid"><section className="panel"><div className="panel-title"><BookOpenCheck/><div><span>MY TEACHING</span><h3>Assigned classes and subjects</h3></div></div>{mine.length?mine.map(item=><article className="document-row" key={item.id}><strong>{item.className}</strong><span>{item.subjectName}</span><small>{item.weeklyPeriods} period{item.weeklyPeriods===1?"":"s"}/week · active</small></article>):<p>No active teaching assignment is attached to this account.</p>}<button onClick={()=>onNavigate("operations")}>Open class workspace</button></section><aside><section className="panel"><div className="panel-title"><GraduationCap/><div><span>LEARNER CONTEXT</span><h3>Support from classroom evidence</h3></div></div><p>Attendance, submitted work and recorded assessment evidence help guide follow-up without exposing unrelated learners.</p><button onClick={()=>onNavigate("learners")}>Open learner records</button></section><section className="panel"><div className="panel-title"><FolderHeart/><div><span>CARE & SAFEGUARDING</span><h3>Record facts and escalate safely</h3></div></div><p>Use the protected care workflow for concerns. Safeguarding decisions remain with authorized staff.</p><button onClick={()=>onNavigate("care")}>Open protected support</button></section></aside></div>
  </div>;
}
