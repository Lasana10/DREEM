import { BookOpenCheck, CalendarClock, ClipboardCheck, FolderHeart, GraduationCap, WifiOff } from "lucide-react";
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
  const myLearnerAssignments = workspace.academics.assignmentsForLearners.filter(item => mineIds.has(item.teachingAssignmentId));
  const myAssignmentIds = new Set(myLearnerAssignments.map(item => item.id));
  const pending = workspace.academics.assignmentSubmissions.filter(item => myAssignmentIds.has(item.assignmentId) && (item.status === "submitted" || item.status === "late") && learnerIds.has(item.studentId));
  const drafts = myLearnerAssignments.filter(item => item.status === "draft");
  const published = myLearnerAssignments.filter(item => item.status === "published");
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const weekday = now.getDay() === 0 ? 7 : now.getDay();
  const currentMinutes = now.getHours()*60+now.getMinutes();
  const todayPeriods = periods.filter(item => item.weekday === weekday && item.effectiveFrom <= today && item.effectiveTo >= today).sort((a,b)=>minutes(a.startsAt)-minutes(b.startsAt));
  const next = todayPeriods.find(item => minutes(item.endsAt) >= currentMinutes);
  return <div className="content teacher-home">
    <section className="page-intro"><div><span>DREEM TEACHER · TODAY</span><h2>Your classroom day in one place.</h2><p>Teaching, attendance, coursework and learner follow-up stay connected to your assigned classes. Server permissions remain authoritative.</p></div><div className="care-assurance"><CalendarClock/><span><strong>{today}</strong><small>{todayPeriods.length} teaching period{todayPeriods.length===1?"":"s"} today</small></span></div></section>
    <div className="metrics"><article className="metric blue"><span>My classes</span><strong>{classes.length}</strong><small>{mine.length} active subject assignment{mine.length===1?"":"s"}</small></article><article className="metric"><span>Marking queue</span><strong>{pending.length}</strong><small>Submitted or late work awaiting action</small></article><article className="metric amber"><span>Draft assignments</span><strong>{drafts.length}</strong><small>{published.length} currently published</small></article><article className="metric violet"><span>Offline readiness</span><strong>Online writes</strong><small>Durable local outbox is still being built; offline writes are not presented as confirmed.</small></article></div>
    <section className="panel"><div className="panel-title"><CalendarClock/><div><span>NEXT TEACHING PERIOD</span><h3>{next ? `${next.className} · ${next.subjectName}` : "No remaining scheduled class today"}</h3></div></div>{next ? <><p><strong>{next.startsAt}–{next.endsAt}</strong> · {next.room || "Room not assigned"}</p><button className="primary" onClick={()=>onNavigate("operations")}>Open classroom</button></> : <p>Your Today view will surface the next active period from the authoritative timetable.</p>}</section>
    <div className="dashboard-grid"><section className="panel"><div className="panel-title"><BookOpenCheck/><div><span>MY TEACHING</span><h3>Assigned classes and subjects</h3></div></div>{mine.length?mine.map(item=><article className="document-row" key={item.id}><strong>{item.className}</strong><span>{item.subjectName}</span><small>{item.weeklyPeriods} period{item.weeklyPeriods===1?"":"s"}/week · active</small></article>):<p>No active teaching assignment is attached to this account.</p>}<button onClick={()=>onNavigate("operations")}>Attendance & lesson planning</button></section><aside><section className="panel"><div className="panel-title"><ClipboardCheck/><div><span>WORK QUEUE</span><h3>What needs action</h3></div></div><p><strong>{pending.length}</strong> learner submission{pending.length===1?"":"s"} awaiting marking or revision decision.</p><button onClick={()=>onNavigate("learning")}>Open assignments & marking</button></section><section className="panel"><div className="panel-title"><GraduationCap/><div><span>LEARNER CONTEXT</span><h3>{learnerIds.size} learners in my classes</h3></div></div><p>Only learner records permitted by assigned-class RLS are available.</p><button onClick={()=>onNavigate("learners")}>Open learner records</button></section></aside></div>
    <section className="panel"><div className="panel-title"><FolderHeart/><div><span>SUPPORT & SAFEGUARDING</span><h3>Escalate evidence, do not diagnose</h3></div></div><p>Record observations through the protected care workflow. Consequential safeguarding decisions remain human-controlled.</p><button onClick={()=>onNavigate("care")}>Open learner support</button></section>
    <section className="panel"><div className="panel-title"><WifiOff/><div><span>CONNECTIVITY CONTRACT</span><h3>No false offline promise</h3></div></div><p>Until the durable local outbox and conflict engine are shipped, cached reading remains distinct from server-confirmed writes.</p></section>
  </div>;
}
