import type { Role } from "../domain/types";
import type { AuthorityScope } from "./authority";
import { humanizeRole, legacyAuthorityScopes } from "./authority";
import { isSupabaseConfigured, supabase } from "./supabase";

const ACTIVE_SCHOOL="dreem-active-school-id";
export type ActiveSchoolContext={schoolId:string;userId:string;role:Role;positionTitle:string;authorityScopes:AuthorityScope[]};
export type SchoolMembershipContext={schoolId:string;schoolName:string;role:Role;positionTitle:string;authorityScopes:AuthorityScope[]};

type SchoolContextRow={school_id:unknown;school_name:unknown;role:unknown;position_title?:unknown;authority_scopes?:unknown};
export function cachedActiveSchoolId(){if(typeof localStorage==="undefined")return"";return localStorage.getItem(ACTIVE_SCHOOL)??"";}
export function cacheActiveSchoolId(schoolId:string){if(typeof localStorage!=="undefined"&&schoolId)localStorage.setItem(ACTIVE_SCHOOL,schoolId);}
export function clearActiveSchoolId(){if(typeof localStorage!=="undefined")localStorage.removeItem(ACTIVE_SCHOOL);}

function normalizeMembership(row:SchoolContextRow):SchoolMembershipContext{
  const role=row.role as Role;
  const scopes=Array.isArray(row.authority_scopes)?row.authority_scopes.map(String) as AuthorityScope[]:legacyAuthorityScopes(role);
  return{
    schoolId:String(row.school_id),
    schoolName:String(row.school_name),
    role,
    positionTitle:row.position_title?String(row.position_title):humanizeRole(role),
    authorityScopes:scopes.length?scopes:legacyAuthorityScopes(role),
  };
}

export async function listApprovedSchoolContexts():Promise<{userId:string;memberships:SchoolMembershipContext[]}>{
  if(!isSupabaseConfigured||!supabase)throw new Error("DREEM school context is unavailable.");
  const [{data:rows,error:contextError},{data:userData,error:userError}]=await Promise.all([supabase.rpc("dreem_list_my_school_contexts"),supabase.auth.getUser()]);
  if(contextError)throw contextError;if(userError)throw userError;const user=userData.user;if(!user)throw new Error("Sign in again before using school operations.");
  const memberships=((rows??[]) as SchoolContextRow[]).map(normalizeMembership);
  if(!memberships.length)throw new Error("No approved school membership was found.");
  return{userId:user.id,memberships};
}
async function persistServerSchool(schoolId:string){if(!supabase)throw new Error("DREEM school context is unavailable.");const{error}=await supabase.rpc("dreem_select_active_school",{p_school_id:schoolId});if(error)throw error;cacheActiveSchoolId(schoolId);}

export async function resolveActiveSchoolContext():Promise<ActiveSchoolContext>{
  const{userId,memberships}=await listApprovedSchoolContexts();const cached=cachedActiveSchoolId();
  if(cached){const membership=memberships.find(item=>item.schoolId===cached);if(!membership){clearActiveSchoolId();throw new Error("DREEM_SCHOOL_SELECTION_REQUIRED");}await persistServerSchool(membership.schoolId);return{schoolId:membership.schoolId,userId,role:membership.role,positionTitle:membership.positionTitle,authorityScopes:membership.authorityScopes};}
  if(memberships.length>1)throw new Error("DREEM_SCHOOL_SELECTION_REQUIRED");
  const membership=memberships[0];await persistServerSchool(membership.schoolId);return{schoolId:membership.schoolId,userId,role:membership.role,positionTitle:membership.positionTitle,authorityScopes:membership.authorityScopes};
}

export async function selectActiveSchoolContext(schoolId:string,memberships:SchoolMembershipContext[]){const membership=memberships.find(item=>item.schoolId===schoolId);if(!membership)throw new Error("That school is not an approved membership for this account.");await persistServerSchool(membership.schoolId);return membership;}
export function requireCachedSchoolContext(actorId:string,role:Role):ActiveSchoolContext{const schoolId=cachedActiveSchoolId();if(!schoolId)throw new Error("Connect once while online and choose the school before saving work offline on this device.");if(!actorId)throw new Error("This account needs a verified user identity before offline work can be saved.");return{schoolId,userId:actorId,role,positionTitle:humanizeRole(role),authorityScopes:legacyAuthorityScopes(role)};}
