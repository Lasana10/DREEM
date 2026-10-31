import { useEffect, useMemo, useState } from "react";
import { BookCheck, Filter, RefreshCw } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import { calculateOutcomeCoverage,loadOutcomeLessonLinks,type OutcomeLessonLink } from "../lib/curriculumCoverage";
import { userFacingError } from "../lib/userFacingError";

export default function CurriculumCoveragePanel({workspace,teacherOnly,onPlanOutcome}:{workspace:WorkspaceData;teacherOnly:boolean;onPlanOutcome?:(outcomeId:string)=>void}){
 const [links,setLinks]=useState<OutcomeLessonLink[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[version,setVersion]=useState(0);
 const [classFilter,setClassFilter]=useState("all"),[stateFilter,setStateFilter]=useState("all");
 useEffect(()=>{
  let active=true;
  loadOutcomeLessonLinks(workspace.academics.lessonPlans).then(rows=>{if(active){setLinks(rows);setError("");}}).catch(reason=>{if(active)setError(userFacingError(reason,"Curriculum evidence links could not be loaded."));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[workspace,version]);
 const coverage=useMemo(()=>calculateOutcomeCoverage(workspace.academics.curriculumOutcomes,workspace.academics.assignments,
  workspace.academics.lessonPlans,links,workspace.viewer.id,teacherOnly),[workspace,links,teacherOnly]);
 const classes=useMemo(()=>Array.from(new Set(coverage.map(x=>x.outcome.classId))),[coverage]);
 const selected=coverage.filter(row=>(classFilter==="all"||row.outcome.classId===classFilter)&&(stateFilter==="all"||row.state===stateFilter));
 const evidenced=coverage.filter(x=>x.state==="reviewed_evidence").length,awaiting=coverage.filter(x=>x.state==="pending_review").length;
 const classNames=new Map(workspace.setup.classes.map(x=>[x.id,x.name]));
 const subjectNames=new Map(workspace.setup.subjects.map(x=>[x.id,x.name]));
 return <section className="excellence-coverage" aria-label="Curriculum progress supported by lesson evidence">
  <div className="excellence-register-header"><div><span className="excellence-kicker-dark"><BookCheck size={15}/> CURRICULUM · TEACHING EVIDENCE</span>
   <h2>Curriculum coverage</h2><p>See approved outcomes linked to recorded lesson plans and their independent review status. Planning evidence is not proof of completed teaching or pupil mastery.</p></div>
   <button type="button" className="excellence-cancel" disabled={loading} onClick={()=>{setLoading(true);setVersion(v=>v+1);}}><RefreshCw size={15}/> Refresh</button></div>
  {error&&<p className="form-status error" role="alert">{error}</p>}
  {loading?<p role="status">Loading curriculum-to-lesson evidence…</p>:<>
   <div className="excellence-coverage-metrics"><div><strong>{coverage.length}</strong><span>Active assigned outcomes</span></div><div><strong>{evidenced}</strong><span>With reviewed lesson evidence</span></div><div><strong>{awaiting}</strong><span>Awaiting lesson review</span></div><div><strong>{coverage.length-evidenced-awaiting}</strong><span>Returned only / no recorded link</span></div></div>
   <div className="excellence-coverage-filter"><Filter size={16}/><label>Class<select aria-label="Filter curriculum class" value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option value="all">All assigned classes</option>{classes.map(id=><option key={id} value={id}>{classNames.get(id)??"Class"}</option>)}</select></label><label>Evidence<select aria-label="Filter curriculum evidence" value={stateFilter} onChange={e=>setStateFilter(e.target.value)}><option value="all">All outcomes</option><option value="reviewed_evidence">Reviewed lesson plan</option><option value="pending_review">Awaiting review</option><option value="returned_only">Returned plans only</option><option value="not_recorded">No linked plan</option></select></label></div>
   {selected.length===0?<p className="excellence-queue-empty">No curriculum outcomes match these filters or assignments.</p>:
    <div className="excellence-coverage-table-wrap"><table className="excellence-weekly-table"><thead><tr><th>Outcome</th><th>Class / Subject</th><th>Evidence status</th><th>Lesson plans</th><th>Reviewed</th>{onPlanOutcome&&<th>Next action</th>}</tr></thead><tbody>{selected.map(row=><tr key={row.outcome.id}><td><strong>{row.outcome.code}</strong><small>{row.outcome.titleEn}</small>{row.outcome.titleFr&&<small>{row.outcome.titleFr}</small>}</td><td>{classNames.get(row.outcome.classId)??"Class"} · {subjectNames.get(row.outcome.subjectId)??"Subject"}</td><td><span className={"excellence-coverage-state "+row.state}>{row.state.replaceAll("_"," ")}</span></td><td>{row.plans.length}</td><td>{row.reviewedPlans}</td>{onPlanOutcome&&<td><button type="button" className="excellence-cancel" onClick={()=>onPlanOutcome(row.outcome.id)}>Plan lesson</button></td>}</tr>)}</tbody></table></div>}
   <p className="excellence-weekly-disclaimer">Coverage uses explicit links in DREEM lesson-plan records. An outcome can have multiple linked plans; reviewed evidence confirms academic plan review, not lesson observation, learner understanding or mastery.</p>
  </>}
 </section>;
}
