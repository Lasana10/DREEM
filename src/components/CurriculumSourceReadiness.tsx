import { BookOpenCheck, FileSearch, ShieldCheck, TriangleAlert } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";

export default function CurriculumSourceReadiness({workspace}:{workspace:WorkspaceData}){
  const subjects=workspace.setup.subjects;
  const outcomes=workspace.academics.curriculumOutcomes;
  const docs=workspace.academics.documents;
  const rows=subjects.map(subject=>{
    const subjectOutcomes=outcomes.filter(item=>item.subjectId===subject.id&&item.status!=="retired");
    const syllabusDocs=docs.filter(item=>item.subjectId===subject.id&&item.documentType==="syllabus"&&item.status!=="rejected"&&item.status!=="archived");
    const imported=subjectOutcomes.filter(item=>item.source==="imported"||item.source==="national").length;
    const status=syllabusDocs.length&&subjectOutcomes.length?"connected":syllabusDocs.length?"needs-structure":subjectOutcomes.length?"needs-source":"missing";
    return {subject,subjectOutcomes,syllabusDocs,imported,status};
  });
  const connected=rows.filter(row=>row.status==="connected").length;
  const documentsWaiting=rows.filter(row=>row.status==="needs-structure").length;
  return <section className="curriculum-source-map">
    <header>
      <div><span>CURRICULUM SOURCE MAP</span><h3>From official source to classroom delivery</h3><p>DREEM distinguishes a stored syllabus from a structured curriculum. Uploading a document does not pretend that its contents have already been understood or mapped.</p></div>
      <div className="curriculum-source-score"><strong>{connected}/{subjects.length||0}</strong><small>subjects source-connected</small></div>
    </header>
    <div className="curriculum-source-rail">
      <span className="done"><FileSearch/><b>1</b><small>Source document</small></span>
      <span><BookOpenCheck/><b>2</b><small>Structured outcomes</small></span>
      <span><ShieldCheck/><b>3</b><small>Academic validation</small></span>
      <span><BookOpenCheck/><b>4</b><small>Teaching & assessment</small></span>
    </div>
    {documentsWaiting>0?<div className="curriculum-intelligence-note"><TriangleAlert/><div><strong>{documentsWaiting} subject{documentsWaiting===1?" has":"s have"} syllabus evidence but no structured outcomes yet.</strong><p>These documents are stored safely, but extraction and curriculum mapping still require an intelligence/validation step. DREEM does not mark them complete merely because a file exists.</p></div></div>:null}
    <div className="curriculum-source-grid">{rows.slice(0,12).map(row=><article className={row.status} key={row.subject.id}>
      <div><strong>{row.subject.name}</strong><small>{row.syllabusDocs.length} syllabus source{row.syllabusDocs.length===1?"":"s"} · {row.subjectOutcomes.length} outcome{row.subjectOutcomes.length===1?"":"s"}</small></div>
      <span>{row.status==="connected"?"Source connected":row.status==="needs-structure"?"Needs structuring":row.status==="needs-source"?"Needs source evidence":"Not started"}</span>
      {row.imported>0?<small>{row.imported} imported/national outcome{row.imported===1?"":"s"}</small>:null}
    </article>)}</div>
  </section>;
}
