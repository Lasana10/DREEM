import {supabase} from "./supabase";
import {resolveActiveSchoolContext} from "./schoolContext";
import type {ImportedPupil,RegistryReconciliation} from "./pupilRegistryReconciliation";

export type SchoolPupilImportResult={batchId:string;imported:number;alreadyApplied:boolean};
/** Only entirely new, conflict-free batches advance beyond read-only review. */
export function validatePupilImportApproval(rows:ImportedPupil[],review:RegistryReconciliation,confirmed:boolean):string[]{
 const issues:string[]=[];
 if(!confirmed)issues.push("School administration must explicitly approve this import.");
 if(rows.length<1||rows.length>200)issues.push("Import 1 to 200 pupils in one verified batch.");
 if(review.sourceRows!==rows.length||review.newCandidates!==rows.length||review.existingMatches!==0||review.issues.length)issues.push("Every pupil must be a new, conflict-free candidate. Reconcile the file again and split out existing records.");
 if(rows.some(row=>!row.matricule.trim()||!row.fullName.trim()||!row.className.trim()))issues.push("Every pupil requires an existing matricule, name and mapped class.");
 return issues;
}
export async function importReviewedPupils(rows:ImportedPupil[],review:RegistryReconciliation,idempotencyKey:string,confirmed:boolean):Promise<SchoolPupilImportResult>{
 const errors=validatePupilImportApproval(rows,review,confirmed);
 if(errors.length)throw new Error(errors.join(" "));
 if(!supabase)throw new Error("The school database is not connected. No pupils were imported.");
 const context=await resolveActiveSchoolContext();
 if(!["platform_founder","school_owner","principal","administrator"].includes(context.role))throw new Error("Only approved school administrators can import pupil identities.");
 const {data,error}=await supabase.rpc("dreem_import_verified_pupils",{
  p_rows:rows,p_idempotency_key:idempotencyKey,p_confirmation:`IMPORT ${rows.length} NEW PUPILS`
 });
 if(error)throw error;
 if(!data||typeof data!=="object")throw new Error("The import returned no confirmed batch receipt; check the school registry before retrying.");
 const result=data as Record<string,unknown>;
 if(typeof result.batchId!=="string"||typeof result.imported!=="number"||result.imported!==rows.length||typeof result.alreadyApplied!=="boolean")throw new Error("The import receipt is invalid. Do not retry blindly.");
 return {batchId:result.batchId,imported:result.imported,alreadyApplied:result.alreadyApplied};
}
