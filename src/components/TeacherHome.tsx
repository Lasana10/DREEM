import { BookOpenCheck, CalendarClock, ClipboardCheck, GraduationCap, UsersRound } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import type { ViewKey } from "./Shell";

function minutes(value:string){const [h,m]=value.slice(0,5).split(":").map(Number);return h*60+m;}
export default function TeacherHome({workspace,onNavigate}:{workspace:WorkspaceData;onNavigate:(view:ViewKey)=>void}){
 const teacherId=workspace.viewer.id;
 const mine=workspace.academics.assignments.filter(item=>item.status==="active"&&!!teacherId&&item.teacherUserId===teacherId);
 const mineIds=new Set(mine.map(item=>item.id)),classes=Array.from(new Set(mine.map(item=>item.className)));
 const learnerIds=new Set(workspace.learners.filter(l=>classes.includes(l.className)).map(l=>l.id));
 const learnerAssignments=workspace.academics.assignmentsForLearners.filter(item=>mineIds.has(item.teachingAssignmentId));
 const assignmentIds=new Set(learnerAssignments.map(item=>item.id));
 const pending=workspace.academics.assignmentSubmissions.filter(item=>assignmentIds.has(item.assignmentId)&&(item.status==="submitted"||item.status==="late")&&learnerIds.has(item.studentId));
 const drafts=learnerAssignments.filter(item=>item.status==="draft"),published=learnerAssignments.filter(item=>item.status==="published");
 const now=new Date(),today=now.toISOString().slice(0,10),weekday=now.getDay()===0?7:now.getDay(),currentMinutes=now.getHours()*60+now.getMinutes();
 const periods=workspace.academics.timetable.filter(item=>item.status==="active"&&mineIds.has(item.assignmentId));
 const todayPeriods=periods.filter(item=>item.weekday===weekday&&item.effectiveFrom<=today&&item.effectiveTo>=today).sort((a,b)=>minutes(a.startsAt)-minutes(b.startsAt));
 const next=todayPeriods.find(item=>minutes(item.endsAt)>=currentMinutes);
 const completed=todayPeriods.filter(item=>minutes(item.endsAt)<currentMinutes).length;
 return <div className="content teacher-home role-workspace">
  <section className="role-hero"><div><span className="eyebrow">TEACHER · TODAY</span><h2>Good day, {workspace.viewer.name.split(" ")[0]}</h2><p>{next?"Your next class is ready. DREEM keeps the rest of the day behind it.":"Your teaching day is clear. Review marking or prepare what comes next."}</p></div><div className="role-hero-status"><span className="status-pill info"><CalendarClock size={15}/>{todayPeriods.length} classes today</span></div></section>
  <section className="visual-stats">
   <article className="visual-stat"><div className="icon"><CalendarClock/></div><div><span>CLASSES TODAY</span><strong>{todayPeriods.length}</strong><small>{completed} completed</small></div></article>
   <article className="visual-stat green"><div className="icon"><UsersRound/></div><div><span>MY LEARNERS</span><strong>{learnerIds.size}</strong><small>assigned classes</small></div></article>
   <article className="visual-stat amber"><div className="icon"><ClipboardCheck/></div><div><span>TO REVIEW</span><strong>{pending.length}</strong><small>submitted work</small></div></article>
   <article className="visual-stat purple"><div className="icon"><BookOpenCheck/></div><div><span>ASSIGNMENTS</span><strong>{published.length}</strong><small>{drafts.length} drafts</small></div></article>
  </section>
  <div className="focus-grid">
   <section className="focus-card"><div className="panel-title"><div><span>TODAY'S SCHEDULE</span><h3>Your teaching day</h3></div></div><div className="schedule-list">{todayPeriods.length?todayPeriods.map(item=><article className="schedule-row" key={item.id}><time>{item.startsAt}</time><div><strong>{item.className} · {item.subjectName}</strong><small>{item.endsAt} · {item.room||"Room not assigned"}</small></div><button className={item.id===next?.id?"primary":""} onClick={()=>onNavigate("operations")}>{item.id===next?.id?"Open class":"View"}</button></article>):<p>No scheduled class today.</p>}</div></section>
   <aside className="focus-card"><span className="eyebrow">NEXT CLASS</span><h3>{next?next.className+" · "+next.subjectName:"No remaining class"}</h3><p>{next?next.startsAt+"–"+next.endsAt+" · "+(next.room||"Room not assigned"):"Use the time for marking, planning or learner follow-up."}</p><button className="primary" onClick={()=>onNavigate(next?"operations":"learning")}>{next?"Take attendance / open class":"Open assignments"}</button></aside>
  </div>
  <section className="quick-grid" style={{marginTop:14}}>
   <article className="quick-card"><ClipboardCheck/><span>MARKING</span><h3>{pending.length} waiting</h3><p>Open only the work that needs your review now.</p><button onClick={()=>onNavigate("learning")}>Review work</button></article>
   <article className="quick-card"><GraduationCap/><span>LEARNER SUPPORT</span><h3>{learnerIds.size} learners</h3><p>Attendance, work and assessment evidence stay linked to the learner.</p><button onClick={()=>onNavigate("learners")}>Open learners</button></article>
   <article className="quick-card"><BookOpenCheck/><span>MY CLASSES</span><h3>{mine.length} assignments</h3><p>Plans, attendance and classroom evidence in one place.</p><button onClick={()=>onNavigate("operations")}>Open classes</button></article>
  </section>
  <details className="depth-drawer"><summary>How my teaching workflow works</summary><section className="panel lifecycle-panel"><div className="lifecycle-rail"><span className="active"><b>1</b>Prepare</span><span><b>2</b>Teach</span><span><b>3</b>Attendance</span><span><b>4</b>Work</span><span><b>5</b>Assess</span><span><b>6</b>Follow up</span></div></section></details>
 </div>;
}