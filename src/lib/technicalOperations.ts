import { isSupabaseConfigured, supabase } from "./supabase";

export type TechnicalStatus={
  schoolId:string;
  queuedNotifications:number;
  failedNotifications:number;
  offlinePending:number;
  offlineRejected:number;
  approvedMemberships:number;
  generatedAt:string;
};

export async function loadTechnicalStatus():Promise<TechnicalStatus>{
  if(!isSupabaseConfigured||!supabase)throw new Error("DREEM is not connected to the school server.");
  const{data,error}=await supabase.rpc("dreem_technical_status");
  if(error)throw error;
  const row=(data??{}) as Record<string,unknown>;
  return{
    schoolId:String(row.school_id??""),
    queuedNotifications:Number(row.queued_notifications??0),
    failedNotifications:Number(row.failed_notifications??0),
    offlinePending:Number(row.offline_pending??0),
    offlineRejected:Number(row.offline_rejected??0),
    approvedMemberships:Number(row.approved_memberships??0),
    generatedAt:String(row.generated_at??new Date().toISOString()),
  };
}
