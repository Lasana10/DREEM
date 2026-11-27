import {useMemo,useState,type ChangeEvent} from "react";
import {FileSpreadsheet,ShieldCheck} from "lucide-react";
import type {SchoolSetup,CurriculumOutcomeSummary} from "../domain/types";
import {saveCurriculumOutcome} from "../lib/repository";
import {previewCurriculumCsv,type CurriculumCsvPreview} from "../lib/curriculumCsvPreview";
import {userFacingError} from "../lib/userFacingError";

/** School-managed, human-reviewed objectives only. CSV data never becomes "national" by assertion. */
export default function CurriculumImportPanel({setup,outcomes,onRefresh}:{setup:SchoolSetup;outcomes:CurriculumOutcomeSummary[];onRefresh:()=>Promise<void>}){
 const [yearId,setYearId]=useState(setup.academicYears.find(y=>y.status==="active")?.id??"");
 const [classId,setClassId]=useState("");
 const [subjectId,setSubjectId]=useState("");
 const [preview,setPreview]=useState<CurriculumCsvPreview|null>(null);
 const [error,setError]=useState(""),[result,setResult]=useState("");
 const [busy,setBusy]=useState(false);
 const year=setup.academicYears.find(y=>y.id===yearId);
 const schoolClass=setup.classes.find(c=>c.id===classId);
 const subject=setup.subjects.find(s=>s.id===subjectId);
 const existing=useMemo(()=>outcomes.filter(o=>o.academicYearId===yearId&&o.classId===classId&&o.subjectId===subjectId).map(o=>o.code),[outcomes,yearId,classId,subjectId]);
 function resetPreview(){setPreview(null);setError("");setResult("");}
 async function inspect(event:ChangeEvent<HTMLInputElement>){
  const file=event.currentTarget.files?.[0];resetPreview();
  if(!file)return;
  if(file.size>1024*1024){setError("Use a CSV file under 1 MB. Divide larger files by class and subject.");event.currentTarget.value="";return;}
  try{setPreview(previewCurriculumCsv(await file.text(),existing));}
  catch(reason){setError(userFacingError(reason,"The curriculum CSV cannot be inspected."));}
  finally{event.currentTarget.value="";}
 }
 async function importApproved(){
  if(!preview?.valid.length||!year||!schoolClass||!subject){setError("Select one academic year, class, subject and a valid reviewed CSV first.");return;}
  if(year.status!=="active"){setError("Activate the correct academic year through School Studio before importing curriculum objectives.");return;}
  if(schoolClass.academicYearId!==year.id){setError("The chosen class does not belong to the selected academic year.");return;}
  if(preview.issues.length){setError("Correct the flagged source-file issues before approval and import. No rows have been saved.");return;}
  if(!window.confirm(`Confirm that academic leadership has checked all ${preview.valid.length} objective(s) and their source references for ${schoolClass.name} · ${subject.name} · ${year.name}? Each will be saved as school-reviewed, not automatically certified as a national curriculum.`))return;
  setBusy(true);setError("");setResult("");
  let saved=0;
  try{
   for(const item of preview.valid){
    try{await saveCurriculumOutcome({academicYearId:yearId,classId,subjectId,code:item.code,titleEn:item.titleEn,titleFr:item.titleFr,description:`${item.description}${item.description?"\n":""}Source reference: ${item.reference}`,source:"school"});saved++;}
    catch(reason){setError(`Stopped at objective ${item.code}: ${userFacingError(reason,"Not saved")}. ${saved} previously saved; inspect and reconcile before retrying.`);break;}
   }
   setResult(`${saved} of ${preview.valid.length} school-reviewed objective(s) saved. Confirm these with the refreshed curriculum registry before building assessments.`);
   await onRefresh();
   if(saved===preview.valid.length)setPreview(null);
  }catch(reason){setError(userFacingError(reason,"The registry could not be refreshed; verify saved objectives before another attempt."));}
  finally{setBusy(false);}
 }
 return <section className="panel" aria-label="Reviewed curriculum import" style={{marginTop:16}}>
  <div className="panel-title"><FileSpreadsheet/><div><span>ACADEMIC RESOURCE ONBOARDING</span><h3>Import verified curriculum objectives</h3><p>Review a school-approved CSV before creating objectives. No invented syllabus, no AI-generated standards, and no direct publication to pupils.</p></div></div>
  <div className="settings-form">
   <div className="form-grid">
    <label>Academic year<select value={yearId} onChange={e=>{setYearId(e.target.value);setClassId("");resetPreview();}}><option value="">Choose an active year</option>{setup.academicYears.map(y=><option value={y.id} key={y.id}>{y.name} · {y.status}</option>)}</select></label>
    <label>Class<select value={classId} onChange={e=>{setClassId(e.target.value);resetPreview();}}><option value="">Choose class</option>{setup.classes.filter(c=>c.academicYearId===yearId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Subject<select value={subjectId} onChange={e=>{setSubjectId(e.target.value);resetPreview();}}><option value="">Choose subject</option>{setup.subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
   </div>
   <p className="quiet-note">CSV columns: <code>code,title_en,title_fr,description,source_reference</code>. French semicolon CSV is supported. Import one class and one subject per reviewed file; existing codes in that group are skipped.</p>
   <label>Inspect curriculum CSV<input aria-label="Inspect curriculum CSV" type="file" accept=".csv,text/csv" onChange={event=>void inspect(event)} disabled={!yearId||!classId||!subjectId||busy}/></label>
  </div>
  {error&&<p role="alert" className="form-status error">{error}</p>}
  {result&&<p role="status" className="form-status success">{result}</p>}
  {preview&&<div className="studio-stage-body">
   <p role="status"><strong>{preview.total}</strong> file rows · <strong>{preview.valid.length}</strong> eligible · <strong>{preview.duplicates}</strong> duplicates · <strong>{preview.issues.length}</strong> source issues (first 100 shown)</p>
   {preview.issues.length>0&&<div className="form-status error"><strong>Fix these issues before importing:</strong><ul>{preview.issues.slice(0,8).map((i,j)=><li key={j}>{i}</li>)}</ul></div>}
   <div className="compact-table">{preview.valid.slice(0,5).map((item,i)=><div className="document-row" key={i}><strong>{item.code}</strong><span>{item.titleEn}</span><small>{item.reference}</small></div>)}</div>
   <p className="quiet-note"><ShieldCheck size={15}/> Academic leadership must independently verify the official/source documents. Importing does not establish national-curriculum accreditation, and the source references are recorded as review notes.</p>
   <button className="primary" type="button" disabled={busy||!preview.valid.length||!!preview.issues.length||year?.status!=="active"||!schoolClass||schoolClass.academicYearId!==yearId} onClick={()=>void importApproved()}>{busy?"Saving reviewed objectives…":"Confirm review and import objectives"}</button>
  </div>}
 </section>;
}
