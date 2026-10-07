import { isSupabaseConfigured, supabase } from "./supabase";

export type SchoolRecoveryBundle={
  manifest:{format:string;school_id:string;generated_at:string;sha256:string};
  payload:Record<string,unknown>;
};
export type RecoveryVerification={valid:boolean;school_id?:string;sha256?:string;students?:number;guardians?:number;payments?:number;audit_events?:number;reason?:string};

export async function exportSchoolRecoveryBundle():Promise<SchoolRecoveryBundle>{
  if(!isSupabaseConfigured||!supabase)throw new Error("DREEM is not connected to the school server.");
  const{data,error}=await supabase.rpc("dreem_export_school_snapshot");
  if(error)throw error;
  if(!data||typeof data!=="object")throw new Error("The school recovery bundle was not generated.");
  return data as unknown as SchoolRecoveryBundle;
}

export async function verifySchoolRecoveryBundle(bundle:SchoolRecoveryBundle):Promise<RecoveryVerification>{
  if(!isSupabaseConfigured||!supabase)throw new Error("DREEM is not connected to the school server.");
  const{data,error}=await supabase.rpc("dreem_verify_school_snapshot",{p_export:bundle});
  if(error)throw error;
  return (data??{valid:false,reason:"Verification returned no result."}) as unknown as RecoveryVerification;
}

export function downloadRecoveryBundle(bundle:SchoolRecoveryBundle,shortName:string){
  const blob=new Blob([JSON.stringify(bundle,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");
  const date=new Date(bundle.manifest.generated_at||Date.now()).toISOString().slice(0,10);
  anchor.href=url;anchor.download=`${(shortName||"dreem-school").replace(/[^a-z0-9_-]+/gi,"-").toLowerCase()}-recovery-${date}.json`;
  document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
}
