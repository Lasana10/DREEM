import { AlertTriangle, BookOpenCheck, FileText, Link2, ShieldCheck } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";

export default function CurriculumIntelligencePanel({workspace}:{workspace:WorkspaceData}){
  const {academics,setup}=workspace;
  const syllabusDocs=academics.documents.filter(document=>document.documentType==="syllabus");
  const approvedSyllabi=syllabusDocs.filter(document=>document.status==="approved");
  const imported=academics.curriculumOutcomes.filter(outcome=>outcome.source==="imported");
  const national=academics.curriculumOutcomes.filter(outcome=>outcome.source==="national");
  const school=academics.curriculumOutcomes.filter(outcome=>outcome.source==="school");
  const mappedSubjectIds=new Set(academics.curriculumOutcomes.map(outcome=>outcome.subjectId));
  const syllabusSubjectIds=new Set(syllabusDocs.map(document=>document.subjectId).filter(Boolean));
  const subjectsWithNoOutcomes=setup.subjects.filter(subject=>syllabusSubjectIds.has(subject.id)&&!mappedSubjectIds.has(subject.id));
  const subjectsWithoutSource=setup.subjects.filter(subject=>!syllabusSubjectIds.has(subject.id)&&!mappedSubjectIds.has(subject.id));
  const sourceReady=syllabusDocs.length>0;
  const structured=imported.length>0||national.length>0;

  return <section className="curriculum-intelligence">
    <header className="curriculum-intelligence-head">
      <div><span>CURRICULUM EVIDENCE</span><h3>From source documents to what teachers actually teach</h3><p>DREEM separates source evidence from structured curriculum. Uploaded files are never presented as mapped outcomes until an academic reviewer has structured and approved them.</p></div>
      <div className={"curriculum-health "+(sourceReady&&structured?"ready":"attention")}>
        {sourceReady&&structured?<ShieldCheck/>:<AlertTriangle/>}
        <span><strong>{sourceReady&&structured?"Connected":"Needs mapping"}</strong><small>{syllabusDocs.length} syllabus source{syllabusDocs.length===1?"":"s"} · {academics.curriculumOutcomes.length} outcomes</small></span>
      </div>
    </header>

    <div className="curriculum-source-grid">
      <article>
        <FileText/>
        <span>SOURCE LIBRARY</span>
        <strong>{syllabusDocs.length}</strong>
        <p>{approvedSyllabi.length} approved syllabus document{approvedSyllabi.length===1?"":"s"} preserved as school evidence.</p>
      </article>
      <article>
        <BookOpenCheck/>
        <span>STRUCTURED OUTCOMES</span>
        <strong>{academics.curriculumOutcomes.length}</strong>
        <p>{national.length} national · {imported.length} imported · {school.length} school-defined.</p>
      </article>
      <article className={subjectsWithNoOutcomes.length?"attention":""}>
        <Link2/>
        <span>UPLOADS NEEDING STRUCTURE</span>
        <strong>{subjectsWithNoOutcomes.length}</strong>
        <p>{subjectsWithNoOutcomes.length?subjectsWithNoOutcomes.map(subject=>subject.name).slice(0,3).join(", "):"Uploaded syllabus subjects have structured outcomes."}</p>
      </article>
      <article className={subjectsWithoutSource.length?"attention":""}>
        <AlertTriangle/>
        <span>NO SOURCE OR OUTCOMES</span>
        <strong>{subjectsWithoutSource.length}</strong>
        <p>{subjectsWithoutSource.length?subjectsWithoutSource.map(subject=>subject.name).slice(0,3).join(", "):"Every configured subject has curriculum evidence."}</p>
      </article>
    </div>

    {syllabusDocs.length?<div className="curriculum-source-list">{syllabusDocs.slice(0,8).map(document=>{
      const subject=setup.subjects.find(item=>item.id===document.subjectId);
      const outcomeCount=academics.curriculumOutcomes.filter(outcome=>outcome.subjectId===document.subjectId).length;
      return <article key={document.id}>
        <div><FileText/><span><strong>{document.title}</strong><small>{subject?.name??"Unassigned subject"} · {document.language} · {document.status}</small></span></div>
        <div className="curriculum-source-state"><strong>{outcomeCount}</strong><small>structured outcomes</small></div>
      </article>;
    })}</div>:<div className="curriculum-empty"><FileText/><div><strong>No syllabus evidence has been uploaded yet</strong><p>Teachers or academic leadership can upload PDF, Word or scanned syllabus documents from the Academic Library. DREEM will keep the original source protected and visible here.</p></div></div>}

    <div className="curriculum-intelligence-note">
      <AlertTriangle/>
      <div><strong>Document understanding is not yet connected</strong><p>This build now makes the gap explicit instead of pretending file upload equals curriculum intelligence. Automatic extraction, page citations, comparison and approval proposals still require the document-intelligence service.</p></div>
    </div>
  </section>;
}
