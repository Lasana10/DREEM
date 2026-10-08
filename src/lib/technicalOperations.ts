import { loadReleaseManifest, type DreemReleaseManifest } from "./releaseManifest";
import { isSupabaseConfigured, supabase } from "./supabase";

export type TechnicalStatus={
  schoolId:string;
  queuedNotifications:number;
  failedNotifications:number;
  deliveredNotifications:number;
  offlineReceiptsAccepted:number;
  offlineReceiptsRejected:number;
  failedAcceptanceChecks:number;
  approvedMemberships:number;
  generatedAt:string;
};
export type AcceptanceEvidenceRow={
  id:string;
  scenario:string;
  status:"passed"|"failed"|"blocked";
  detail:Record<string,unknown>;
  source:string;
  runAt:string;
};

export async function loadTechnicalOperations(){
  if(!isSupabaseConfigured||!supabase){
    return {status:null as TechnicalStatus|null,release:await loadReleaseManifest(),acceptance:[] as AcceptanceEvidenceRow[]};
  }
  const[{data:raw,error:statusError},release,{data:evidence,error:evidenceError}]=await Promise.all([
    supabase.rpc("dreem_technical_status"),
    loadReleaseManifest(),
    supabase.from("dreem_acceptance_evidence").select("id,scenario,status,detail,source,run_at").order("run_at",{ascending:false}).limit(20),
  ]);
  if(statusError)throw statusError;
  if(evidenceError)throw evidenceError;
  const row=(raw??{}) as Record<string,unknown>;
  return{
    status:{
      schoolId:String(row.school_id??""),
      queuedNotifications:Number(row.queued_notifications??0),
      failedNotifications:Number(row.failed_notifications??0),
      deliveredNotifications:Number(row.delivered_notifications??0),
      offlineReceiptsAccepted:Number(row.offline_receipts_accepted??0),
      offlineReceiptsRejected:Number(row.offline_receipts_rejected??0),
      failedAcceptanceChecks:Number(row.failed_acceptance_checks??0),
      approvedMemberships:Number(row.approved_memberships??0),
      generatedAt:String(row.generated_at??new Date().toISOString()),
    },
    release:release as DreemReleaseManifest,
    acceptance:(evidence??[]).map(item=>({
      id:String(item.id),scenario:String(item.scenario),status:item.status as AcceptanceEvidenceRow["status"],
      detail:(item.detail??{}) as Record<string,unknown>,source:String(item.source),runAt:String(item.run_at),
    })),
  };
}
