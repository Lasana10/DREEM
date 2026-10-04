import { BookOpenCheck, CalendarClock, ClipboardCheck, FolderHeart, GraduationCap, UsersRound } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import type { ViewKey } from "./Shell";
import { evaluateRecommendedPolicies } from "../domain/operationalExcellence";

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
 const policyActions=evaluateRecommendedPolicies({
   learners:workspace.learners,academics:workspace.academics,finance:workspace.finance,transport:workspace.transport,
   admissions:workspace.admissions,signals:workspace.signals,cases:workspace.cases,
 }).filter(item=>item.learnerId&&learnerIds.has(item.learnerId)&&["learner","learning"].includes(item.area));
 const learnersNeedingFollowUp=new Set(policyActions.map(item=>item.learnerId)).size;
 const primaryTeacherAction=next
   ? {eyebrow:"UP NEXT",title:next.className+" · "+next.subjectName,detail:next.startsAt+"–"+next.endsAt+(next.room?" · "+next.room:""),action:"Open class",view:"operations" as ViewKey}
   : pending.length
     ? {eyebrow:"READY FOR YOU",title:pending.length+" submission"+(pending.length===1?"":"s")+" waiting",detail:"Student work is ready for review.",action:"Review work",view:"learning" as ViewKey}
     : policyActions.length
       ? {eyebrow:"CHECK IN",title:policyActions[0].title,detail:policyActions[0].reason,action:"Open learner",view:(policyActions[0].area==="learning"?"learning":"learners") as ViewKey}
       : {eyebrow:"YOU'RE CLEAR",title:"Nothing urgent is waiting",detail:"Your classes, submitted work and learner follow-up are clear for now.",action:"Open my classes",view:"operations" as ViewKey};
 const teacherEvidence=[
   todayPeriods.length+" scheduled class"+(todayPeriods.length===1?"":"es")+" today",
   pending.length+" submitted item"+(pending.length===1?"":"s")+" waiting for review",
   learnersNeedingFollowUp+" learner"+(learnersNeedingFollowUp===1?"":"s")+" worth checking from current attendance or learning patterns",
 ];

 return <div className="content teacher-home role-workspace">
  <section className="role-hero"><div><span className="eyebrow">TEACHER · TODAY</span><h2>Good day, {workspace.viewer.name.split(" ")[0]}</h2><p>{todayPeriods.length} classes today · {pending.length} submissions waiting · {learnerIds.size} learners in your classes</p></div><div className="role-hero-status"><span className="status-pill info"><CalendarClock size={14}/>{today}</span></div></section>
  <section className="intelligence-brief teacher-intelligence-brief">
   <div className="intelligence-brief-main">
    <span>{primaryTeacherAction.eyebrow}</span>
    <h3>{primaryTeacherAction.title}</h3>
    <p>{primaryTeacherAction.detail}</p>
    <button className="primary" onClick={()=>onNavigate(primaryTeacherAction.view)}>{primaryTeacherAction.action}</button>
   </div>
   <aside className="intelligence-evidence"><small>TODAY AT A GLANCE</small>{teacherEvidence.map(item=><div key={item}><span></span><p>{item}</p></div>)}</aside>
  </section>
  <section className="visual-stats">
   <article className="visual-stat"><div className="icon"><CalendarClock/></div><div><span>CLASSES TODAY</span><strong>{todayPeriods.length}</strong><small>{completed} completed · {upcoming} ahead</small></div></article>
   <article className="visual-stat green"><div className="icon"><ClipboardCheck/></div><div><span>TO REVIEW</span><strong>{pending.length}</strong><small>student submissions waiting</small></div></article>
   <article className="visual-stat purple"><div className="icon"><BookOpenCheck/></div><div><span>ASSIGNMENTS</span><strong>{published.length}</strong><small>{drafts.length} draft{drafts.length===1?"":"s"}</small></div></article>
   <article className={"visual-stat "+(learnersNeedingFollowUp?"amber":"green")}><div className="icon"><UsersRound/></div><div><span>LEARNERS TO CHECK</span><strong>{learnersNeedingFollowUp}</strong><small>{learnersNeedingFollowUp?"worth a closer look":"nothing pressing"}</small></div></article>
  </section>
  <div className="focus-grid">
   <section className="focus-card">
    <div className="panel-title"><CalendarClock/><div><span>TODAY'S SCHEDULE</span><h3>Your teaching day</h3></div></div>
    <div className="schedule-list">{todayPeriods.map(item=><div className="schedule-row" key={item.id}><time>{item.startsAt}</time><div><strong>{item.className} · {item.subjectName}</strong><small>{item.endsAt} · {item.room||"Room not assigned"}</small></div>{item.id===next?.id?<button className="primary" onClick={()=>onNavigate("operations")}>Open class</button>:null}</div>)}{!todayPeriods.length?<p>No class is scheduled for today.</p>:null}</div>
   </section>
   <aside className="focus-card">
    <div className="panel-title"><BookOpenCheck/><div><span>NEXT</span><h3>{next?next.className+" · "+next.subjectName:"No class remaining"}</h3></div></div>
    <p>{next?next.startsAt+"–"+next.endsAt+(next.room?" · "+next.room:""):"Your timetable is clear for the rest of today."}</p>
    <div className="card-actions"><button className="primary" onClick={()=>onNavigate("operations")}>{next?"Open class":"Open my classes"}</button></div>
   </aside>
  </div>
  {policyActions.length?<section className="focus-card" style={{marginTop:14}}><div className="panel-title"><FolderHeart/><div><span>LEARNERS TO CHECK</span><h3>{learnersNeedingFollowUp} learner{learnersNeedingFollowUp===1?"":"s"} may need follow-up</h3><p>Attendance and learning patterns can point to who may need a closer look. You decide the right response.</p></div></div><div className="action-list">{policyActions.slice(0,5).map(item=><div className="action-row" key={item.id}><div className="action-icon"><GraduationCap/></div><div><strong>{item.title}</strong><small>{item.reason}</small></div><button onClick={()=>onNavigate(item.area==="learning"?"learning":"learners")}>Review</button></div>)}</div></section>:null}
  <section className="quick-grid" style={{marginTop:14}}>
   <article className="quick-card"><ClipboardCheck/><span>MARKING</span><h3>{pending.length} waiting</h3><p>Review submitted or late work without leaving your teaching workspace.</p><button onClick={()=>onNavigate("learning")}>Review work</button></article>
   <article className="quick-card"><GraduationCap/><span>LEARNERS</span><h3>Class context</h3><p>Open attendance, work and learner support for the classes you teach.</p><button onClick={()=>onNavigate("learners")}>Open learners</button></article>
   <article className="quick-card"><FolderHeart/><span>SUPPORT</span><h3>Record a concern</h3><p>Open a private follow-up when a learner needs academic or safeguarding support.</p><button onClick={()=>onNavigate("care")}>Open support</button></article>
  </section>
  <details className="depth-drawer"><summary>Teaching cycle</summary><section className="panel lifecycle-panel"><div className="panel-title"><BookOpenCheck/><div><span>FROM PREPARATION TO SUPPORT</span><h3>Plan → teach → attendance → work → assess → support</h3></div></div><div className="lifecycle-rail"><span className="active"><b>1</b>Prepare</span><span><b>2</b>Teach</span><span><b>3</b>Attendance</span><span><b>4</b>Work</span><span><b>5</b>Assess</span><span><b>6</b>Support</span></div></section></details>
 </div>;
}