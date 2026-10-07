import { useState, type ChangeEvent } from "react";
import { ArchiveRestore, Download, ShieldCheck, Upload } from "lucide-react";
import type { SchoolBrand } from "../domain/types";
import { downloadRecoveryBundle, exportSchoolRecoveryBundle, verifySchoolRecoveryBundle, type SchoolRecoveryBundle } from "../lib/schoolRecovery";
import { userFacingError } from "../lib/userFacingError";

export default function SchoolRecoveryPanel({brand}:{brand:SchoolBrand}){
  const[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  async function createExport(){
    setBusy(true);setMessage("");setError("");
    try{
      const bundle=await exportSchoolRecoveryBundle();
      downloadRecoveryBundle(bundle,brand.shortName||brand.name);
      const verification=await verifySchoolRecoveryBundle(bundle);
      if(!verification.valid)throw new Error("The generated recovery bundle failed its integrity check.");
      setMessage(`Recovery bundle verified: ${verification.students??0} learners, ${verification.guardians??0} guardians and ${verification.audit_events??0} audit events. Store it securely.`);
    }catch(reason){setError(userFacingError(reason,"The recovery bundle could not be generated. Nothing has been assumed backed up."));}
    finally{setBusy(false);}
  }
  async function verifyFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];if(!file)return;
    setBusy(true);setMessage("");setError("");
    try{
      const parsed=JSON.parse(await file.text()) as SchoolRecoveryBundle;
      const result=await verifySchoolRecoveryBundle(parsed);
      if(!result.valid)throw new Error(result.reason||"The recovery file digest does not match its contents.");
      setMessage(`Recovery file is intact: ${result.students??0} learners, ${result.guardians??0} guardians, ${result.payments??0} payments. This verifies the bundle; it does not overwrite the live school.`);
    }catch(reason){setError(userFacingError(reason,"This recovery file could not be verified."));}
    finally{setBusy(false);event.target.value="";}
  }
  return <section className="panel school-recovery-panel">
    <div className="panel-title"><ArchiveRestore/><div><span>RECOVERY & EXPORT</span><h3>Take a verified school copy without risking live records</h3><p>The bundle contains school operating records and an integrity digest. Credential secrets are excluded.</p></div></div>
    {error?<div className="form-status error" role="alert">{error}</div>:null}
    {message?<div className="form-status success" role="status"><ShieldCheck/>{message}</div>:null}
    <div className="card-actions">
      <button className="primary" disabled={busy} onClick={()=>void createExport()}><Download/>{busy?"Working…":"Download verified recovery bundle"}</button>
      <label className="upload-button"><Upload/>Verify a recovery file<input type="file" accept="application/json,.json" disabled={busy} onChange={event=>void verifyFile(event)}/></label>
    </div>
    <small>Restore is intentionally not executed against the live school. A destructive restore must first be rehearsed in an isolated target and compared with this bundle.</small>
  </section>;
}
