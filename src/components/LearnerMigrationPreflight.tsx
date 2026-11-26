import {useState,type ChangeEvent} from "react";
import {FileSpreadsheet,ShieldCheck} from "lucide-react";
import {previewLearnerCsv,type LearnerImportPreview} from "../lib/learnerImportPreview";
import {userFacingError} from "../lib/userFacingError";

/** Private browser-only migration preflight. It never creates or updates a learner. */
export default function LearnerMigrationPreflight(){
 const [preview,setPreview]=useState<LearnerImportPreview|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 async function inspect(event:ChangeEvent<HTMLInputElement>){
  const file=event.currentTarget.files?.[0];setPreview(null);setError("");
  if(!file)return;
  if(file.size>3*1024*1024){setError("CSV must be 3 MB or smaller for this local preview. Split large exports by class.");event.currentTarget.value="";return;}
  setLoading(true);
  try{const contents=await file.text();setPreview(previewLearnerCsv(contents));}
  catch(reason){setError(userFacingError(reason,"This CSV could not be inspected. Nothing was imported."));}
  finally{setLoading(false);event.currentTarget.value="";}
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
   {preview.warnings.length?<div className="form-status error" role="status"><strong>Review the source before migration:</strong><ul>{preview.warnings.slice(0,8).map((warning,i)=><li key={i}>{warning}</li>)}</ul>{preview.warnings.length>8?<small>Additional issues also detected; correct and recheck the source file.</small>:null}</div>:<p className="form-status success" role="status">No in-file issues detected. Server-side matching and school approval are still required.</p>}
   </div>:null}
 </section>;
}
