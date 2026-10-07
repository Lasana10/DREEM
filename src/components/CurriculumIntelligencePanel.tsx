import { useState, type FormEvent } from "react";
import { AlertTriangle, BookOpenCheck, FileText, Link2, ShieldCheck } from "lucide-react";
import type { WorkspaceData } from "../lib/repository";
import { proposeCurriculumOutcome, reviewCurriculumProposal } from "../lib/repository";
import { userFacingError } from "../lib/userFacingError";

export default function CurriculumIntelligencePanel({workspace,onRefresh}:{workspace:WorkspaceData;onRefresh:()=>Promise<void>}){
  const {academics,setup}=workspace;
  const syllabusDocs=academics.documents.filter(document=>document.documentType==="syllabus");
  const approvedSyllabi=syllabusDocs.filter(document=>document.status==="approved");
  const imported=academics.curriculumOutcomes.filter(outcome=>outcome.source==="imported");
  const national=academics.curriculumOutcomes.filter(outcome=>outcome.source==="national");
  const school=academics.curriculumOutcomes.filter(outcome=>outcome.source==="school");
  const mappedSubjectIds=new Set(academics.curriculumOutcomes.map(outcome=>outcome.subjectId));
  const syllabusSubjectIds=new Set(syllabusDocs.map(document=>document.subjectId).filter(Boolean));
  const subjectsWithoutSource=setup.subjects.filter(subject=>!syllabusSubjectIds.has(subject.id)&&!mappedSubjectIds.has(subject.id));
  const sourceReady=syllabusDocs.length>0,structured=imported.length>0||national.length>0;
  const openProposals=academics.curriculumProposals.filter(item=>item.status==="proposed");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const activeYear=setup.academicYears.find(item=>item.status==="active")?.id??setup.academicYears[0]?.id??"";
  const defaultClass=setup.classes[0]?.id??"",defaultSubject=setup.subjects[0]?.id??"";
  async function run(action:()=>Promise<unknown>,success:string){setBusy(true);setMessage("");setError("");try{await action();await onRefresh();setMessage(success);}catch(reason){setError(userFacingError(reason,"The curriculum action could not be completed. Nothing has been assumed saved."));}finally{setBusy(false);}}
  function propose(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget,f=new FormData(form);void run(async()=>{await proposeCurriculumOutcome({
    documentId:String(f.get("documentId")),academicYearId:String(f.get("academicYearId")),classId:String(f.get("classId")),subjectId:String(f.get("subjectId")),
    code:String(f.get("code")),titleEn:String(f.get("titleEn")),titleFr:String(f.get("titleFr")||""),description:String(f.get("description")||""),
    pageStart:Number(f.get("pageStart"))||undefined,pageEnd:Number(f.get("pageEnd"))||undefined,section:String(f.get("section")||""),excerpt:String(f.get("excerpt")||""),
    confidence:Number(f.get("confidence"))||undefined,provider:"human",
  });form.reset();},"Curriculum proposal saved with source provenance. It still requires teacher review and academic approval.");}
  function approve(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);void run(()=>reviewCurriculumProposal({
    proposalId:String(f.get("proposalId")),decision:String(f.get("decision")) as "accepted"|"corrected"|"rejected",code:String(f.get("code")||""),
    titleEn:String(f.get("titleEn")||""),titleFr:String(f.get("titleFr")||""),description:String(f.get("description")||""),note:String(f.get("note")||"Reviewed against cited source"),
  }),"Curriculum proposal reviewed. Approved outcomes now carry immutable source provenance.");}
  const feedbackFor=(proposalId:string)=>academics.curriculumFeedback.filter(item=>item.proposalId===proposalId);
  const provenanceByOutcome=new Map(academics.curriculumProvenance.map(item=>[item.outcomeId,item]));

  return <section className="curriculum-intelligence">
    <header className="curriculum-intelligence-head"><div><span>CURRICULUM EVIDENCE</span><h3>From source documents to approved classroom outcomes</h3><p>Every imported outcome points back to a source version and page or section. Teacher review informs the decision; academic leadership remains final publishing authority.</p></div><div className={"curriculum-health "+(sourceReady&&structured?"ready":"attention")}>{sourceReady&&structured?<ShieldCheck/>:<AlertTriangle/>}<span><strong>{sourceReady&&structured?"Connected evidence":"Needs mapping"}</strong><small>{syllabusDocs.length} source{syllabusDocs.length===1?"":"s"} · {academics.curriculumOutcomes.length} approved outcomes · {openProposals.length} proposals</small></span></div></header>
    {error?<div className="form-status error" role="alert">{error}</div>:null}{message?<div className="form-status success" role="status">{message}</div>:null}
    <div className="curriculum-source-grid">
      <article><FileText/><span>SOURCE LIBRARY</span><strong>{syllabusDocs.length}</strong><p>{approvedSyllabi.length} approved syllabus document{approvedSyllabi.length===1?"":"s"} preserved as school evidence.</p></article>
      <article><BookOpenCheck/><span>APPROVED OUTCOMES</span><strong>{academics.curriculumOutcomes.length}</strong><p>{national.length} national · {imported.length} imported · {school.length} school-defined.</p></article>
      <article className={openProposals.length?"attention":""}><Link2/><span>REVIEW QUEUE</span><strong>{openProposals.length}</strong><p>Suggestions remain non-authoritative until final academic approval.</p></article>
      <article className={subjectsWithoutSource.length?"attention":""}><AlertTriangle/><span>NO SOURCE OR OUTCOMES</span><strong>{subjectsWithoutSource.length}</strong><p>{subjectsWithoutSource.length?subjectsWithoutSource.map(subject=>subject.name).slice(0,3).join(", "):"Every configured subject has curriculum evidence."}</p></article>
    </div>

    <details className="workflow-exceptions" open={openProposals.length===0&&syllabusDocs.length>0}><summary>Create a cited curriculum proposal from a source</summary><form className="settings-form" onSubmit={propose}><div className="form-grid">
      <label>Source document<select name="documentId" required defaultValue=""><option value="">Choose syllabus source</option>{syllabusDocs.map(item=><option key={item.id} value={item.id}>{item.title} · v1 · {item.status}</option>)}</select></label>
      <label>Academic year<select name="academicYearId" required defaultValue={activeYear}>{setup.academicYears.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Class<select name="classId" required defaultValue={defaultClass}>{setup.classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Subject<select name="subjectId" required defaultValue={defaultSubject}>{setup.subjects.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Outcome code<input name="code" required placeholder="ENG-READ-01"/></label><label>English title<input name="titleEn" required/></label><label>French title<input name="titleFr"/></label>
      <label>Page start<input name="pageStart" type="number" min="1"/></label><label>Page end<input name="pageEnd" type="number" min="1"/></label><label>Section<input name="section" placeholder="e.g. Competency 2.1"/></label>
      <label>Extraction confidence<input name="confidence" type="number" min="0" max="1" step="0.01" placeholder="Optional"/></label>
    </div><label>Description<textarea name="description" rows={2}/></label><label>Source excerpt / verification note<textarea name="excerpt" rows={3} placeholder="Short source fragment or verification note. Do not paste entire documents."/></label><button className="primary" disabled={busy||!syllabusDocs.length}>Save proposal for review</button></form></details>

    {openProposals.length?<section className="curriculum-review-queue"><div className="panel-title"><ShieldCheck/><div><span>ACADEMIC APPROVAL</span><h3>Verify source, teacher response and final wording</h3></div></div>{openProposals.map(item=>{
      const doc=syllabusDocs.find(d=>d.id===item.documentId),subject=setup.subjects.find(s=>s.id===item.subjectId),feedback=feedbackFor(item.id);
      const sourceLabel=item.sourcePageStart?"Page "+item.sourcePageStart+(item.sourcePageEnd&&item.sourcePageEnd!==item.sourcePageStart?"–"+item.sourcePageEnd:""):item.sourceSection??"Source section required";
      const confidence=item.confidence!==undefined?" · extraction confidence "+Math.round(item.confidence*100)+"%":"";
      const teacherFeedback=feedback.length?" · average usefulness "+(feedback.reduce((sum,row)=>sum+row.usefulness,0)/feedback.length).toFixed(1)+"/5":"";
      return <form key={item.id} className="panel settings-form curriculum-proposal-review" onSubmit={approve}><input type="hidden" name="proposalId" value={item.id}/><div className="object-header"><div><span>{subject?.name??"Subject"} · {doc?.title??"Source"} v{item.documentVersion}</span><h4>{item.proposedCode} · {item.proposedTitleEn}</h4><p>{sourceLabel}{confidence} · provider {item.extractionProvider}</p></div><Link2/></div>{item.sourceExcerpt?<blockquote>{item.sourceExcerpt}</blockquote>:null}<div className="form-status success"><BookOpenCheck/>Teacher response: {item.teacherDecision??"not reviewed yet"}{item.teacherNote?" · "+item.teacherNote:""}{teacherFeedback}</div><div className="form-grid"><label>Decision<select name="decision" defaultValue="accepted"><option value="accepted">Approve as reviewed</option><option value="corrected">Approve with correction</option><option value="rejected">Reject</option></select></label><label>Code<input name="code" defaultValue={item.teacherCode??item.proposedCode}/></label><label>English title<input name="titleEn" defaultValue={item.teacherTitleEn??item.proposedTitleEn}/></label><label>French title<input name="titleFr" defaultValue={item.teacherTitleFr??item.proposedTitleFr??""}/></label></div><label>Final description<textarea name="description" rows={2} defaultValue={item.teacherDescription??item.proposedDescription??""}/></label><label>Review note<input name="note" defaultValue="Checked against cited source and teacher response."/></label><button className="primary" disabled={busy}>Record academic decision</button></form>;
    })}</section>:null}

    {academics.curriculumOutcomes.length?<div className="curriculum-source-list">{academics.curriculumOutcomes.slice(0,12).map(outcome=>{const provenance=provenanceByOutcome.get(outcome.id),doc=provenance?syllabusDocs.find(d=>d.id===provenance.documentId):undefined;const source=outcome.source==="imported"&&provenance?(doc?.title??"Source")+" v"+provenance.documentVersion+(provenance.pageStart?" · p."+provenance.pageStart+(provenance.pageEnd&&provenance.pageEnd!==provenance.pageStart?"–"+provenance.pageEnd:""):provenance.sectionLabel?" · "+provenance.sectionLabel:""):outcome.source+" outcome";return <article key={outcome.id}><div><BookOpenCheck/><span><strong>{outcome.code} · {outcome.titleEn}</strong><small>{source}</small></span></div><div className="curriculum-source-state"><strong>{outcome.status}</strong><small>{provenance?"source verified":"school-defined"}</small></div></article>})}</div>:null}
    {!syllabusDocs.length?<div className="curriculum-empty"><FileText/><div><strong>No syllabus evidence has been uploaded yet</strong><p>Upload a PDF, Word document or scan first. DREEM preserves the original source and requires provenance before an imported outcome can be approved.</p></div></div>:null}
    <div className="curriculum-intelligence-note"><AlertTriangle/><div><strong>Automatic extraction provider not connected</strong><p>The full review and provenance workflow is operational now. Human proposals work today. A model or OCR provider may later create proposals, but it cannot publish curriculum directly and must supply the same citations, confidence and review evidence.</p></div></div>
  </section>;
}
