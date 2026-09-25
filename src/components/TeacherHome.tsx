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
  const concerns=workspace.cases.filter(item=>!["resolved","closed"].includes(item.status)).length;
  const now=new Date(),today=now.toISOString().slice(0,10),weekday=now.getDay()===0?7:now.getDay(),currentMinutes=now.getHours()*60+now.getMinutes();
  const todayPeriods=periods.filter(item=>item.weekday===weekday&&item.effectiveFrom<=today&&item.effectiveTo>=today).sort((a,b)=>minutes(a.startsAt)-minutes(b.startsAt));
  const next=todayPeriods.find(item=>minutes(item.endsAt)>=currentMinutes);

  return <div className="content teacher-home role-workspace">
    <section className="role-hero">
      <div><span className="eyebrow">DREEM TEACHER · TODAY</span><h2>Good day, {workspace.viewer.name.split(" ")[0]}</h2><p>{todayPeriods.length} class{todayPeriods.length===1?"":"es"} today · {pending.length} submission{pending.length===1?"":"s"} waiting · {concerns} learner concern{concerns===1?"":"s"}</p></div>
      <div className="role-hero-status"><span className="status-pill info"><CalendarClock size={15}/>{today}</span></div>
    </section>

    <div className="visual-stats">
      <article className="visual-stat"><div className="icon"><CalendarClock/></div><div><span>CLASSES TODAY</span><strong>{todayPeriods.length}</strong><small>{next?"Next "+next.startsAt:"No class remaining"}</small></div></article>
      <article className="visual-stat green"><div className="icon"><ClipboardCheck/></div><div><span>TO REVIEW</span><strong>{pending.length}</strong><small>Submitted learner work</small></div></article>
      <article className="visual-stat purple"><div className="icon"><UsersRound/></div><div><span>MY LEARNERS</span><strong>{learnerIds.size}</strong><small>Across assigned classes</small></div></article>
      <article className="visual-stat amber"><div className="icon"><FolderHeart/></div><div><span>NEEDS ATTENTION</span><strong>{concerns}</strong><small>Open support concern(s)</small></div></article>
    </div>

    <div className="focus-grid">
      <section className="focus-card">
        <span className="eyebrow">NEXT CLASS</span>
        <h3>{next?next.className+" · "+next.subjectName:"No remaining scheduled class"}</h3>
        <p>{next?next.startsAt+"–"+next.endsAt+" · "+(next.room||"Room not assigned"):"Open your classes to prepare upcoming work."}</p>
        <button className="primary" onClick={()=>onNavigate("operations")}>{next?"Open class & take attendance":"Open my classes"}</button>
        <div className="schedule-list">
          {todayPeriods.map(item=><article className="schedule-row" key={item.id}><time>{item.startsAt}</time><div><strong>{item.className} · {item.subjectName}</strong><small>{item.endsAt} · {item.room||"Room not assigned"}</small></div><button onClick={()=>onNavigate("operations")}>Open</button></article>)}
          {!todayPeriods.length?<p>No teaching period is scheduled today.</p>:null}
        </div>
      </section>

      <aside className="action-list">
        <article className="action-row"><div className="action-icon"><ClipboardCheck/></div><div><strong>{pending.length} work item{pending.length===1?"":"s"} to review</strong><small>Mark, comment or request correction.</small></div><button onClick={()=>onNavigate("learning")}>Review</button></article>
        <article className="action-row"><div className="action-icon"><GraduationCap/></div><div><strong>Learner support</strong><small>Open classroom evidence and follow-up.</small></div><button onClick={()=>onNavigate("learners")}>Open</button></article>
        <article className="action-row"><div className="action-icon"><FolderHeart/></div><div><strong>Protected concern</strong><small>Record facts and escalate safely.</small></div><button onClick={()=>onNavigate("care")}>Open</button></article>
      </aside>
    </div>

    <details className="depth-drawer"><summary>Teaching details</summary><section className="panel"><div className="panel-title"><BookOpenCheck/><div><span>MY TEACHING</span><h3>Assigned classes and subjects</h3></div></div>{mine.map(item=><article className="document-row" key={item.id}><strong>{item.className}</strong><span>{item.subjectName}</span><small>{item.weeklyPeriods} period{item.weeklyPeriods===1?"":"s"}/week</small></article>)}{!mine.length?<p>No active teaching assignment is attached to this account.</p>:null}</section></details>
  </div>;
}
