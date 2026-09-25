import { BookOpenCheck, CalendarClock, ClipboardCheck, FolderHeart, GraduationCap, UsersRound } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import type { ViewKey } from "./Shell";

function minutes(value:string){const [h,m]=value.slice(0,5).split(":").map(Number);return h*60+m;}

export default function TeacherHome({workspace,onNavigate}:{workspace:WorkspaceData;onNavigate:(view:ViewKey)=>void}){
 const teacherId=workspace.viewer.id;
 const mine=workspace.academics.assignments.filter(item=>item.status==="active"&&!!teacherId&&item.teacherUserId===teacherId);
 const mineIds=new Set(mine.map(item=>item.id));
 const periods=workspace.academics.timetable.filter(item=>item.status==="active"&&mineIds.has(item.assignmentId));
 const classes=Array.from(new Set(mine.map(item=>item.className)));
 const learnerIds=new Set(workspace.learners.filter(l=>classes.includes(l.className)).map(l=>l.id));
 const learnerAssignments=workspace.academics.assignmentsForLearners.filter(item=>mineIds.has(item.teachingAssignmentId));
 const assignmentIds=new Set(learnerAssignments.map(item=>item.id));
 const pending=workspace.academics.assignmentSubmissions.filter(item=>assignmentIds.has(item.assignmentId)&&(item.status==="submitted"||item.status==="late")&&learnerIds.has(item.studentId));
 const drafts=learnerAssignments.filter(item=>item.status==="draft");
 const published=learnerAssignments.filter(item=>item.status==="published");
 const now=new Date(),today=now.toISOString().slice(0,10),weekday=now.getDay()===0?7:now.getDay(),currentMinutes=now.getHours()*60+now.getMinutes();
 const todayPeriods=periods.filter(item=>item.weekday===weekday&&item.effectiveFrom<=today&&item.effectiveTo>=today).sort((a,b)=>minutes(a.startsAt)-minutes(b.startsAt));
 const next=todayPeriods.find(item=>minutes(item.endsAt)>=currentMinutes);
 const completed=todayPeriods.filter(item=>minutes(item.endsAt)<currentMinutes).length;
 const upcoming=todayPeriods.filter(item=>minutes(item.startsAt)>currentMinutes).length;

 return <div className="content teacher-home role-workspace">
  <section className="role-hero"><div><span className="eyebrow">DREEM TEACHER · TODAY</span><h2>Good day, {workspace.viewer.name.split(" ")[0]}</h2><p>{todayPeriods.length} classes today · {pending.length} submissions waiting · {learnerIds.size} learners in your classes</p></div><div className="role-hero-status"><span className="status-pill info"><CalendarClock size={14}/>{today}</span></div></section>
  <section className="visual-stats">
   <article className="visual-stat"><div className="icon"><CalendarClock/></div><div><span>CLASSES TODAY</span><strong>{todayPeriods.length}</strong><small>{completed} completed · {upcoming} ahead</small></div></article>
   <article className="visual-stat green"><div className="icon"><ClipboardCheck/></div><div><span>TO REVIEW</span><strong>{pending.length}</strong><small>student submissions waiting</small></div></article>
   <article className="visual-stat purple"><div className="icon"><BookOpenCheck/></div><div><span>ASSIGNMENTS</span><strong>{published.length}</strong><small>{drafts.length} draft{drafts.length===1?"":"s"}</small></div></article>
   <article className="visual-stat amber"><div className="icon"><UsersRound/></div><div><span>MY LEARNERS</span><strong>{learnerIds.size}</strong><small>across {classes.length} class{classes.length===1?"":"es"}</small></div></article>
  </section>
  <div className="focus-grid">
   <section className="focus-card">
    <div className="panel-title"><CalendarClock/><div><span>TODAY'S SCHEDULE</span><h3>Your teaching day</h3></div></div>
    <div className="schedule-list">{todayPeriods.map(item=><div className="schedule-row" key={item.id}><time>{item.startsAt}</time><div><strong>{item.className} · {item.subjectName}</strong><small>{item.endsAt} · {item.room||"Room not assigned"}</small></div>{item.id===next?.id?<button className="primary" onClick={()=>onNavigate("operations")}>Open class</button>:null}</div>)}{!todayPeriods.length?<p>No active teaching period today.</p>:null}</div>
   </section>
   <aside className="focus-card">
    <div className="panel-title"><BookOpenCheck/><div><span>NEXT</span><h3>{next?next.className+" · "+next.subjectName:"No class remaining"}</h3></div></div>
    <p>{next?next.startsAt+"–"+next.endsAt+(next.room?" · "+next.room:""):"Your timetable is clear for the rest of today."}</p>
    <div className="card-actions"><button className="primary" onClick={()=>onNavigate("operations")}>{next?"Take attendance / open class":"Open my classes"}</button></div>
   </aside>
  </div>
  <section className="quick-grid" style={{marginTop:14}}>
   <article className="quick-card"><ClipboardCheck/><span>MARKING</span><h3>{pending.length} waiting</h3><p>Review submitted or late work without leaving your teaching workspace.</p><button onClick={()=>onNavigate("learning")}>Review work</button></article>
   <article className="quick-card"><GraduationCap/><span>LEARNERS</span><h3>Class context</h3><p>Open attendance, work and learner support only for the classes you teach.</p><button onClick={()=>onNavigate("learners")}>Open learners</button></article>
   <article className="quick-card"><FolderHeart/><span>SUPPORT</span><h3>Record a concern</h3><p>Use protected follow-up when a learner needs academic or safeguarding attention.</p><button onClick={()=>onNavigate("care")}>Open support</button></article>
  </section>
  <details className="depth-drawer"><summary>How DREEM handles the teaching cycle</summary><section className="panel lifecycle-panel"><div className="panel-title"><BookOpenCheck/><div><span>TEACHING CYCLE</span><h3>Plan → teach → attendance → work → assess → support</h3></div></div><div className="lifecycle-rail"><span className="active"><b>1</b>Prepare</span><span><b>2</b>Teach</span><span><b>3</b>Attendance</span><span><b>4</b>Work</span><span><b>5</b>Assess</span><span><b>6</b>Support</span></div></section></details>
 </div>;
}