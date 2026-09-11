import type { Role } from "../domain/types";
import { isSupabaseConfigured, supabase } from "./supabase";

const ACTIVE_SCHOOL="dreem-active-school-id";
export type ActiveSchoolContext={schoolId:string;userId:string;role:Role};

export function cachedActiveSchoolId(){
  if(typeof localStorage==="undefined")return "";
  return localStorage.getItem(ACTIVE_SCHOOL)??"";
}

export function cacheActiveSchoolId(schoolId:string){
  if(typeof localStorage!=="undefined"&&schoolId)localStorage.setItem(ACTIVE_SCHOOL,schoolId);
}

export async function resolveActiveSchoolContext():Promise<ActiveSchoolContext>{
  if(!isSupabaseConfigured||!supabase)throw new Error("DREEM school context is unavailable.");
  const [{data:memberships,error:membershipError},{data:userData,error:userError}]=await Promise.all([
    supabase.from("dreem_school_memberships").select("school_id,role").eq("status","approved"),
    supabase.auth.getUser(),
  ]);
  if(membershipError)throw membershipError;if(userError)throw userError;
  const user=userData.user;if(!user)throw new Error("Sign in again before using school operations.");
  const rows=(memberships??[]) as {school_id:string;role:Role}[];
  if(!rows.length)throw new Error("No approved school membership was found.");
  const cached=cachedActiveSchoolId();
  const membership=rows.find(item=>String(item.school_id)===cached)??rows[0];
  const schoolId=String(membership.school_id);cacheActiveSchoolId(schoolId);
  return {schoolId,userId:user.id,role:membership.role};
}

export function requireCachedSchoolContext(actorId:string,role:Role):ActiveSchoolContext{
  const schoolId=cachedActiveSchoolId();
  if(!schoolId)throw new Error("Connect once while online before saving school work offline on this device.");
  if(!actorId)throw new Error("This account needs a verified user identity before offline work can be saved.");
  return {schoolId,userId:actorId,role};
}
