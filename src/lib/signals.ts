import type { CommunitySignal } from "../domain/types";
import { routeSignal } from "../domain/rules";
import { isSupabaseConfigured, supabase } from "./supabase";

export type NewCommunitySignal=Omit<CommunitySignal,"id"|"status"|"assignedRole"|"createdAt">;

export async function createCommunitySignal(input:NewCommunitySignal):Promise<CommunitySignal>{
  const assignedRole=routeSignal(input.category);
  if(!isSupabaseConfigured||!supabase){
    return {...input,id:crypto.randomUUID(),status:"new",assignedRole,createdAt:new Date().toISOString()};
  }
  const {data:memberships,error:membershipError}=await supabase.from("dreem_school_memberships").select("school_id").eq("status","approved").limit(2);
  if(membershipError)throw membershipError;
  if(!memberships?.length)throw new Error("No active school membership was found for this feedback.");
  if(memberships.length>1)throw new Error("Choose the active school before submitting feedback.");
  const schoolId=String(memberships[0].school_id);
  const {data,error}=await supabase.from("dreem_community_signals").insert({
    school_id:schoolId,
    source_role:input.sourceRole,
    source_name:input.sourceName.trim(),
    subject_type:input.subjectType,
    subject_name:input.subjectName.trim(),
    category:input.category.trim(),
    message:input.message.trim(),
    severity:input.severity,
    assigned_role:assignedRole,
  }).select("id,source_role,source_name,subject_type,subject_name,category,message,severity,status,assigned_role,created_at").single();
  if(error)throw error;
  return {
    id:String(data.id),
    sourceRole:data.source_role,
    sourceName:String(data.source_name),
    subjectType:data.subject_type,
    subjectName:String(data.subject_name),
    category:String(data.category),
    message:String(data.message),
    severity:data.severity,
    status:data.status,
    assignedRole:data.assigned_role,
    createdAt:String(data.created_at),
  } as CommunitySignal;
}
