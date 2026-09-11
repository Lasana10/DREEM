import type { Role } from "../domain/types";
import { isSupabaseConfigured, supabase } from "./supabase";

const ACTIVE_SCHOOL="dreem-active-school-id";
export type ActiveSchoolContext={schoolId:string;userId:string;role:Role};
export type SchoolMembershipContext={schoolId:string;role:Role};

export function cachedActiveSchoolId(){
  if(typeof localStorage==="undefined")return "";
  return localStorage.getItem(ACTIVE_SCHOOL)??"";
}

export function cacheActiveSchoolId(schoolId:string){
  if(typeof localStorage!=="undefined"&&schoolId)localStorage.setItem(ACTIVE_SCHOOL,schoolId);
}

export function clearActiveSchoolId(){
  if(typeof localStorage!=="undefined")localStorage.removeItem(ACTIVE_SCHOOL);
}

export async function listApprovedSchoolContexts():Promise<{userId:string;memberships:SchoolMembershipContext[]}>{
  if(!isSupabaseConfigured||!supabase)throw new Error("DREEM school context is unavailable.");
  const [{data:memberships,error:membershipError},{data:userData,error:userError}]=await Promise.all([
    supabase.from("dreem_school_memberships").select("school_id,role").eq("status","approved"),
    supabase.auth.getUser(),
  ]);
  if(membershipError)throw membershipError;if(userError)throw userError;
  const user=userData.user;if(!user)throw new Error("Sign in again before using school operations.");
  const rows=(memberships??[]).map(item=>({schoolId:String(item.school_id),role:item.role as Role}));
  if(!rows.length)throw new Error("No approved school membership was found.");
  return {userId:user.id,memberships:rows};
}

export async function resolveActiveSchoolContext():Promise<ActiveSchoolContext>{
  const {userId,memberships}=await listApprovedSchoolContexts();
  const cached=cachedActiveSchoolId();
  if(cached){
    const membership=memberships.find(item=>item.schoolId===cached);
    if(!membership){clearActiveSchoolId();throw new Error("The selected school is no longer available. Choose an active school again.");}
    return {schoolId:membership.schoolId,userId,role:membership.role};
  }
  if(memberships.length>1)throw new Error("Choose the active school before continuing. DREEM will not guess between multiple school memberships.");
  const membership=memberships[0];cacheActiveSchoolId(membership.schoolId);
  return {schoolId:membership.schoolId,userId,role:membership.role};
}

export function selectActiveSchoolContext(schoolId:string,memberships:SchoolMembershipContext[]){
  const membership=memberships.find(item=>item.schoolId===schoolId);
  if(!membership)throw new Error("That school is not an approved membership for this account.");
  cacheActiveSchoolId(membership.schoolId);
  return membership;
}

export function requireCachedSchoolContext(actorId:string,role:Role):ActiveSchoolContext{
  const schoolId=cachedActiveSchoolId();
  if(!schoolId)throw new Error("Connect once while online and choose the school before saving work offline on this device.");
  if(!actorId)throw new Error("This account needs a verified user identity before offline work can be saved.");
  return {schoolId,userId:actorId,role};
}
