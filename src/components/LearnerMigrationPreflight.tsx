import {useState,type ChangeEvent} from "react";
import {FileSpreadsheet,ShieldCheck} from "lucide-react";
import {previewLearnerCsv,type LearnerImportPreview} from "../lib/learnerImportPreview";
import {userFacingError} from "../lib/userFacingError";
import {fetchSchoolRegistryIndex,parsePupilCsvForReconciliation,reconcilePupils,type RegistryReconciliation} from "../lib/pupilRegistryReconciliation";
import {supabase} from "../lib/supabase";
import {resolveActiveSchoolContext} from "../lib/schoolContext";

/** Private browser-only migration preflight. It never creates or updates a learner. */
export default function LearnerMigrationPreflight(){
 const [preview,setPreview]=useState<LearnerImportPreview|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 const [reconciling,setReconciling]=useState(false);
 const [reconciliation,setReconciliation]=useState<RegistryReconciliation|null>(null);
 const [csv,setCsv]=useState("");
 async function inspect(event:ChangeEvent<HTMLInputElement>){
  const file=event.currentTarget.files?.[0];setPreview(null);setError("");setReconciliation(null);setCsv("");
  if(!file)return;
  if(file.size>3*1024*1024){setError("CSV must be 3 MB or smaller for this local preview. Split large exports by class.");event.currentTarget.value="";return;}
  setLoading(true);
  try{const contents=await file.text();setPreview(previewLearnerCsv(contents));setCsv(contents);}
  catch(reason){setError(userFacingError(reason,"This CSV could not be inspected. Nothing was imported."));}
  finally{setLoading(false);event.currentTarget.value="";}
 }
 async function compare(){
  if(!csv||!preview)return;
  setReconciling(true);setError("");setReconciliation(null);
  try{
   if(!supabase)throw new Error("School database connection is unavailable.");
   const context=await resolveActiveSchoolContext();
   if(!["platform_founder","school_owner","principal","administrator"].includes(context.role))throw new Error("School administration approval is required for pupil reconciliation.");
   const {data:classRows,error:classError}=await supabase.from("dreem_classes").select("name").eq("school_id",context.schoolId).limit(1000);
   if(classError)throw classError;
   if((classRows??[]).length===1000)throw new Error("The class catalogue is too large for this local comparison.");
   const registry=await fetchSchoolRegistryIndex();
   setReconciliation(reconcilePupils(parsePupilCsvForReconciliation(csv),registry,(classRows??[]).map(c=>String(c.name))));
  }catch(reason){setError(userFacingError(reason,"Registry reconciliation failed. No records were imported."));}
  finally{setReconciling(false);}
 }
 return <section className="panel" aria-label="Existing school learner import preflight">
  <div className="panel-title"><FileSpreadsheet/><div><span>EXISTING SCHOOL TRANSITION</span><h3>Check your pupil export before migration</h3><p>Inspect a CSV file privately on this device. DREEM does not upload it, replace pupil IDs or create records here.</p></div></div>
  <div className="settings-form"><label>Choose a CSV exported from your existing system
   <input type="file" accept=".csv,text/csv,text/plain" onChange={event=>void inspect(event)} disabled={loading}/>
  </label><p className="quiet-note">Include existing matricule, pupil name and class. A column for guardian phone can be included but never establishes parent access automatically. Excel spreadsheets should first be exported as CSV.</p></div>
  {loading?<p role="status">Checking file on this device…</p>:null}
  {error?<p className="form-status error" role="alert">{error}</p>:null}
  {preview?<div className="studio-stage-body">
   <div className="studio-overview">
    <article><span>RECORDS SEEN</span><strong>{preview.rows}</strong><small>in file</small></article>
    <article><span>READY FOR MATCHING</span><strong>{preview.accepted}</strong><small>not imported</small></article>
    <article><span>CHECKS TO REVIEW</span><strong>{preview.warnings.length}</strong><small>first 100 listed</small></article>
   </div>
   <p className="quiet-note"><ShieldCheck size={15}/> Local preflight only. The next step is a separately authorised server-side match against the school's existing registry, with preview, approvals, reconciliation and rollback. No data was sent to DREEM.</p>
   <p><strong>Recognised fields:</strong> {preview.mappedFields.join(", ")}</p>
   <div className="card-actions"><button type="button" disabled={loading||reconciling||!csv||preview.warnings.length>0} onClick={()=>void compare()}>{reconciling?"Comparing existing school IDs…":"Compare against school registry"}</button></div>
   {reconciliation&&<section aria-label="Pupil migration reconciliation results">
    <div className="studio-overview"><article><span>SOURCE RECORDS</span><strong>{reconciliation.sourceRows}</strong></article><article><span>ALREADY REGISTERED</span><strong>{reconciliation.existingMatches}</strong></article><article><span>NEW CANDIDATES</span><strong>{reconciliation.newCandidates}</strong><small>Not created</small></article><article><span>REVIEW ITEMS</span><strong>{reconciliation.issues.length}</strong><small>First 500</small></article></div>
    <p className="quiet-note"><ShieldCheck size={15}/> Read-only comparison completed using authorised school records. Existing matricules must never be recreated. No import, parent verification, pupil identity change or cutover occurred.</p>
    {reconciliation.issues.length>0?<div className="form-status" role="status"><strong>Record-matching outcomes:</strong><ul>{reconciliation.issues.slice(0,12).map((issue,i)=><li key={i}>CSV row {issue.line} · {issue.matricule}: {issue.detail}</li>)}</ul></div>:<p className="form-status" role="status">No source-to-registry conflicts detected. Separate school approval, import staging, backups and rollback are still required before cutover.</p>}
   </section>}

   {preview.warnings.length?<div className="form-status error" role="status"><strong>Review the source before migration:</strong><ul>{preview.warnings.slice(0,8).map((warning,i)=><li key={i}>{warning}</li>)}</ul>{preview.warnings.length>8?<small>Additional issues also detected; correct and recheck the source file.</small>:null}</div>:<p className="form-status success" role="status">No in-file issues detected. Server-side matching and school approval are still required.</p>}
   </div>:null}
 </section>;
}
