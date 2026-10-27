import { useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Info } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";

const iso = (date:Date) => [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
export function weekStart(value:string):string {
  const date=new Date(value+"T12:00:00");
  if(Number.isNaN(date.getTime())) return value;
  date.setDate(date.getDate()-((date.getDay()+6)%7));
  return iso(date);
}
export function weeklyEvidence(workspace:WorkspaceData, start:string, teacherOnly:boolean) {
  const assignments=workspace.academics.assignments.filter(item=>item.status==="active"&&(!teacherOnly||item.teacherUserId===workspace.viewer.id));
  return assignments.map(assignment=>{
    const plans=workspace.academics.lessonPlans.filter(plan=>plan.assignmentId===assignment.id&&weekStart(plan.lessonDate)===start);
    const reviewed=plans.filter(plan=>plan.status==="reviewed").length;
    const returned=plans.filter(plan=>plan.status==="returned").length;
    const submitted=plans.filter(plan=>plan.status==="submitted").length;
    return { assignment,plans,reviewed,returned,submitted,recorded:plans.length,planned:assignment.weeklyPeriods };
  });
}
export default function WeeklyEvidencePanel({workspace,teacherOnly}:{workspace:WorkspaceData;teacherOnly:boolean}){
 const [start,setStart]=useState(()=>weekStart(iso(new Date())));
 const rows=useMemo(()=>weeklyEvidence(workspace,start,teacherOnly),[workspace,start,teacherOnly]);
 const total=rows.reduce((sum,row)=>sum+row.recorded,0);
 const awaiting=rows.reduce((sum,row)=>sum+row.submitted,0);
 const notSubmitted=rows.filter(row=>row.recorded===0).length;
 return <section className="excellence-weekly" aria-label="Weekly lesson evidence">
  <div className="excellence-weekly-top"><div><span className="excellence-kicker-dark"><CalendarDays size={15}/> WEEKLY ACADEMIC EVIDENCE</span><h2>{teacherOnly?"My teaching week":"Teaching evidence across the school"}</h2><p>Existing lesson plans grouped by assigned teaching week. This is an evidence overview, not a separately certified weekly register.</p></div><label>Week beginning<input aria-label="Week beginning" type="date" value={start} onChange={e=>e.target.value&&setStart(weekStart(e.target.value))}/></label></div>
  <div className="excellence-weekly-metrics"><span><b>{total}</b> lesson plans</span><span><b>{awaiting}</b> awaiting review</span><span><b>{notSubmitted}</b> assignments without recorded plans</span></div>
  {!rows.length?<div className="excellence-weekly-empty"><ClipboardList size={22}/><strong>No assigned classes available</strong><p>Approved teacher assignments must be configured before weekly records can appear.</p></div>:
   <div className="excellence-weekly-table-wrap"><table className="excellence-weekly-table"><thead><tr><th>Class & subject</th>{!teacherOnly&&<th>Teacher</th>}<th>Expected periods</th><th>Plans recorded</th><th>Awaiting review</th><th>Returned</th></tr></thead><tbody>{rows.map(row=><tr key={row.assignment.id}><td><strong>{row.assignment.className}</strong><small>{row.assignment.subjectName}</small></td>{!teacherOnly&&<td>{row.assignment.teacherName}</td>}<td>{row.planned}</td><td>{row.recorded}</td><td>{row.submitted}</td><td>{row.returned}</td></tr>)}</tbody></table></div>}
  <p className="excellence-weekly-disclaimer"><Info size={15}/> Planned timetable periods and saved lesson plans are different measures. Missing entries are review prompts, not proof of absence or misconduct. Marking completion requires additional verified evidence.</p>
 </section>;
}
