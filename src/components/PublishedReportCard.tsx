import { useState } from "react";
import { FileText, Printer, X } from "lucide-react";
import type { LearnerSummary, ReportCardSummary, SchoolBrand } from "../domain/types";
import { loadPublishedReportCardDetail, type PublishedReportCardDetail } from "../lib/reportCards";
import { userFacingError } from "../lib/userFacingError";

const percent=(value:number|undefined)=>typeof value==="number"?`${value.toFixed(1)}%`:"—";

export default function PublishedReportCard({report,learner,brand}:{report:ReportCardSummary;learner:LearnerSummary;brand:SchoolBrand}){
  const [detail,setDetail]=useState<PublishedReportCardDetail|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function show(){setOpen(true);if(detail||busy)return;setBusy(true);setError("");try{setDetail(await loadPublishedReportCardDetail(report.id));}catch(reason){setError(userFacingError(reason,"This published report could not be opened. Check your connection and try again."));}finally{setBusy(false);}}
  return <>
    <article className="document-row report-card-row"><div><strong>{report.termName}</strong><small>Published report · revision {report.revision}</small></div><span>{percent(report.overallAverage)}</span><button type="button" onClick={()=>void show()}><FileText/>Open report</button></article>
    {open?<div className="report-card-backdrop" role="dialog" aria-modal="true" aria-label={`${learner.name} ${report.termName} report card`}>
      <section className="report-card-sheet">
        <div className="report-card-toolbar"><button type="button" onClick={()=>setOpen(false)}><X/>Close</button><button type="button" onClick={()=>window.print()} disabled={!detail}><Printer/>Print</button></div>
        <header className="report-card-school"><div className="report-card-school-mark">{brand.logoUrl?<img src={brand.logoUrl} alt=""/>:<span>{brand.shortName.slice(0,3)}</span>}</div><div><strong>{brand.name}</strong><small>{brand.address}{brand.city?` · ${brand.city}`:""}</small><p>{brand.motto}</p></div></header>
        <div className="report-card-title"><span>ACADEMIC REPORT</span><h2>{report.termName}</h2><small>Revision {report.revision}</small></div>
        <section className="report-card-learner"><div><small>Learner</small><strong>{learner.name}</strong></div><div><small>Matricule</small><strong>{learner.matricule}</strong></div><div><small>Class</small><strong>{learner.className}</strong></div><div><small>Overall average</small><strong>{percent(detail?.overallAverage??report.overallAverage)}</strong></div></section>
        {busy?<p className="report-card-loading">Loading the published school record…</p>:null}
        {error?<div className="form-status error" role="alert">{error}<button type="button" onClick={()=>{setDetail(null);void show();}}>Try again</button></div>:null}
        {detail?<>
          <section className="report-card-results"><header><strong>Subject results</strong><small>{detail.evidenceCount} assessment record{detail.evidenceCount===1?"":"s"} used</small></header>{detail.subjects.length?<div className="report-card-table"><div className="report-card-table-head"><span>Subject</span><span>Average</span><span>Assessments</span></div>{detail.subjects.map(subject=><div className="report-card-table-row" key={subject.id}><strong>{subject.subjectName}</strong><span>{percent(subject.averagePercent)}</span><span>{subject.assessmentCount}</span></div>)}</div>:<p>No subject breakdown is available for this published revision.</p>}</section>
          {detail.teacherComment?<section className="report-card-comment"><small>Teacher comment</small><p>{detail.teacherComment}</p></section>:null}
          <footer className="report-card-footer"><span>Generated {new Date(detail.generatedAt).toLocaleDateString()}</span><span>Published {new Date(detail.publishedAt).toLocaleDateString()}</span><span>School record · {brand.shortName}</span></footer>
        </>:null}
      </section>
    </div>:null}
  </>;
}
