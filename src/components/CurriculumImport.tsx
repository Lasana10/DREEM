import {useState,type ChangeEvent} from "react";
import type {WorkspaceData} from "../lib/repository";
import {saveCurriculumOutcome} from "../lib/repository";
import {previewCurriculumCsv,type CurriculumCsvPreview} from "../lib/curriculumCsvPreview";
import {userFacingError} from "../lib/userFacingError";

/** School-reviewed curriculum bootstrap: never invent official content or automatically publish CSV rows. */
export default function CurriculumImport({workspace,onRefresh}:{workspace:WorkspaceData;onRefresh:()=>Promise<void>}){
 const [year,setYear]=useState(workspace.setup.academicYears.find(y=>y.status==="active")?.id??workspace.setup.academicYears[0]?.id??"");
 const [classId,setClassId]=useState("");
 const [subjectId,setSubjectId]=useState("");
 const [preview,setPreview]=useState<CurriculumCsvPreview|null>(null);
 const [approved,setApproved]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const eligibleClasses=workspace.setup.classes.filter(c=>c.academicYearId===year);
 function reset(){setPreview(null);setApproved(false);setMessage("");setError("");}
 async function inspect(e:ChangeEvent<HTMLInputElement>){
  const file=e.currentTarget.files?.[0];reset();
  if(!file)return;
  try{
   if(file.size>2*1024*1024)throw new Error("File exceeds 2 MB. Export a smaller curriculum CSV.");
   const codes=workspace.academics.curriculumOutcomes.filter(o=>o.academicYearId===year&&o.classId===classId&&o.subjectId===subjectId).map(o=>o.code);
   setPreview(previewCurriculumCsv(await file.text(),codes));
  }catch(reason){setError(userFacingError(reason,"The curriculum file could not be inspected. No school records were changed."));}
  finally{e.currentTarget.value="";}
 }
 async function importReviewed(){
  if(!approved||!preview||!year||!classId||!subjectId||preview.valid.length===0||preview.issues.length>0){
   setError("Choose one academic year, class, subject and a fully valid, reviewed source before importing.");return;
  }
  if(preview.valid.length>50){setError("Review and import no more than 50 objectives at a time.");return;}
  if(!window.confirm(`Import ${preview.valid.length} reviewed curriculum objectives as active school records for this class? This requires academic leadership approval and cannot be automatically undone.`))return;
  setBusy(true);setError("");setMessage("");
  let saved=0;
  try{
   for(const item of preview.valid){
    await saveCurriculumOutcome({academicYearId:year,classId,subjectId,code:item.code,titleEn:item.titleEn,titleFr:item.titleFr,
     description:[item.description,`Source reference: ${item.reference}`].filter(Boolean).join("\n"),source:"imported"});
    saved++;
   }
   setPreview(null);setApproved(false);
   setMessage(`${saved} curriculum objectives imported. The school's authoritative records have been updated.`);
  }catch(reason){
   setError(`Import stopped after ${saved} of ${preview.valid.length} objectives. Already saved items were not removed. Reopen this class to reconcile before retrying. ${userFacingError(reason,"The next curriculum objective could not be saved.")}`);
  }finally{
   setBusy(false);
   if(saved>0){try{await onRefresh();}catch{setError(previous=>previous+" The school workspace could not be refreshed; verify records before retrying.");}}
  }
 }
 return <section className="panel" aria-label="Reviewed curriculum CSV import">
  <div className="panel-title"><div><span>ACADEMIC RESOURCE ACTIVATION</span><h3>Import reviewed curriculum objectives</h3><p>Use a school-verified export with code, title_en and source_reference. No automatic AI-generated curriculum, no hidden approval.</p></div></div>
  <div className="settings-form">
   <div className="form-grid">
    <label>Academic year<select value={year} onChange={e=>{setYear(e.target.value);setClassId("");reset();}}>{workspace.setup.academicYears.map(y=><option key={y.id} value={y.id}>{y.name} · {y.status}</option>)}</select></label>
    <label>Class<select value={classId} onChange={e=>{setClassId(e.target.value);reset();}}><option value="">Choose the class</option>{eligibleClasses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Subject<select value={subjectId} onChange={e=>{setSubjectId(e.target.value);reset();}}><option value="">Choose the subject</option>{workspace.setup.subjects.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
   </div>
   <label>Curriculum CSV<input type="file" accept=".csv,text/csv" disabled={busy||!year||!classId||!subjectId} onChange={event=>void inspect(event)}/></label>
   <p className="quiet-note">Required columns: code, title_en, source_reference. Optional: title_fr, description. The file is read on this device first; only explicitly approved rows are sent when you confirm import.</p>
   {preview?<div role="status" className="form-status"><strong>{preview.total} reviewed rows · {preview.valid.length} valid · {preview.issues.length} issues · {preview.duplicates} duplicates.</strong>
    {preview.valid.slice(0,5).map(item=><p key={item.code}>{item.code} — {item.titleEn} · {item.reference}</p>)}
    {preview.issues.slice(0,8).map((issue,i)=><p key={i}>{issue}</p>)}
    {preview.issues.length>8?<p>More issues detected. Correct the original file and inspect it again.</p>:null}
   </div>:null}
   {preview&&preview.valid.length>0&&preview.issues.length===0?<label><input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)}/> I am authorised by the school to approve these objectives, and I have verified every source reference and curriculum mapping.</label>:null}
   <button type="button" className="primary" disabled={busy||!approved||!preview||preview.valid.length<1||preview.valid.length>50||preview.issues.length>0} onClick={()=>void importReviewed()}>{busy?"Importing and verifying…":"Import authorised curriculum objectives"}</button>
   {message?<p className="form-status success" role="status">{message}</p>:null}
   {error?<p className="form-status error" role="alert">{error}</p>:null}
  </div>
 </section>;
}
