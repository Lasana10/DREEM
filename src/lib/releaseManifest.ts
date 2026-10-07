import { isSupabaseConfigured, supabase } from "./supabase";

export type DreemReleaseManifest={
  available:boolean;
  product?:string;
  releaseContract?:string;
  databaseContract?:string;
  edgeContract?:Record<string,number>;
  generatedAt?:string;
  frontendCommit:string;
};

export async function loadReleaseManifest():Promise<DreemReleaseManifest>{
  const frontendCommit=(import.meta.env.VITE_DREEM_RELEASE_SHA as string|undefined)?.trim()||"unstamped";
  if(!isSupabaseConfigured||!supabase)return{available:false,frontendCommit};
  const{data,error}=await supabase.rpc("dreem_release_manifest");
  if(error)throw error;
  const row=(data??{}) as Record<string,unknown>;
  return{
    available:row.available===true,
    product:row.product?String(row.product):undefined,
    releaseContract:row.release_contract?String(row.release_contract):undefined,
    databaseContract:row.database_contract?String(row.database_contract):undefined,
    edgeContract:row.edge_contract&&typeof row.edge_contract==="object"?row.edge_contract as Record<string,number>:undefined,
    generatedAt:row.generated_at?String(row.generated_at):undefined,
    frontendCommit,
  };
}

export function releaseAlignment(manifest:DreemReleaseManifest|null){
  if(!manifest?.available)return{label:"Release unverified",state:"partial" as const};
  if(manifest.frontendCommit==="unstamped")return{label:`${manifest.releaseContract??"DREEM"} · DB verified · frontend unstamped`,state:"partial" as const};
  return{label:`${manifest.releaseContract??"DREEM"} · ${manifest.frontendCommit.slice(0,8)}`,state:"verified" as const};
}
