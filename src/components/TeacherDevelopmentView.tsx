import { BookOpenCheck, ShieldCheck, Sparkles } from "lucide-react";
import type { TeacherSummary } from "../domain/types";

export default function TeacherDevelopmentView({teachers}:{teachers:TeacherSummary[]}){
 const balanced=teachers.filter(item=>item.workload==="balanced").length;
 const support=teachers.filter(item=>item.nextSupport&&item.nextSupport.trim().length>0);
 const strongest=[...teachers].sort((a,b)=>b.mastery-a.mastery)[0];
 return <div className="content teacher-growth-workspace role-workspace">
  <section className="role-hero"><div><span className="eyebrow">TEACHING TEAM</span><h2>Help teachers do their best work</h2><p>Use classroom results, workload and support needs to guide coaching—not to reduce a teacher to a score.</p></div><div className="role-hero-status"><span className="status-pill info"><ShieldCheck size={14}/>Human-led coaching</span></div></section>
  <section className="teacher-growth-summary"><article><span>TEAM</span><strong>{teachers.length}</strong><small>teachers in view</small></article><article><span>WORKLOAD</span><strong>{balanced}</strong><small>currently balanced</small></article><article><span>FOLLOW-UP</span><strong>{support.length}</strong><small>coaching actions</small></article>{strongest?<article><span>STRONGEST MASTERY</span><strong>{strongest.mastery}%</strong><small>{strongest.name}</small></article>:null}</section>
  <section className="teacher-growth-list"><header className="object-header"><div><span>COACHING</span><h3>Teaching team</h3><p>Open the conversation with context: what is working, what is heavy, and where support may help.</p></div><BookOpenCheck/></header>{teachers.length===0?<p className="empty-copy">Teacher progress will appear once classes and learning records are available.</p>:teachers.map(teacher=><article className="teacher-growth-row" key={teacher.id}><div className="teacher-growth-person"><strong>{teacher.name}</strong><small>{teacher.subject||"Subject not assigned"}</small></div><div><span>Learner progress</span><strong>{teacher.learnerGrowth>=0?"+":""}{teacher.learnerGrowth}%</strong></div><div><span>Coverage / mastery</span><strong>{teacher.coverage}% / {teacher.mastery}%</strong></div><div><span>Workload</span><strong>{teacher.workload}</strong></div><div className="teacher-growth-support"><Sparkles/><span><small>Next support</small><strong>{teacher.nextSupport||"No follow-up recorded"}</strong></span></div></article>)}</section>
  <p className="quiet-note"><ShieldCheck size={15}/>DREEM can organise the picture and suggest where to look. Coaching, performance decisions and disciplinary decisions remain human.</p>
 </div>;
}
