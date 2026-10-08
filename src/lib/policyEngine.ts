import { isSupabaseConfigured, supabase } from "./supabase";
import { resolveActiveSchoolContext } from "./schoolContext";

export type PolicyCode="attendance_followup"|"missing_work_followup"|"fee_overdue_followup";
export type PolicyActionLevel="notify"|"remind"|"review"|"restrict_specific_service";
export type PolicyService="exam"|"report"|"trip"|"renewal"|"graduation"|"transport"|"boarding"|"library"|"activity"|"document";

export interface PolicyRule{
  id:string;
  schoolId:string;
  code:PolicyCode;
  name:string;
  domain:string;
  threshold:number;
  actionLevel:PolicyActionLevel;
  targetService?:PolicyService;
  ownerScope:string;
  enabled:boolean;
  recommended:boolean;
}

function requireClient(){
  if(!isSupabaseConfigured||!supabase)throw new Error("DREEM policy settings require the production Supabase connection.");
  return supabase;
}

export async function loadPolicyRules():Promise<PolicyRule[]>{
  const client=requireClient();
  const {schoolId}=await resolveActiveSchoolContext();
  const {data,error}=await client.from("dreem_policy_rules").select("*").eq("school_id",schoolId).order("code");
  if(error)throw error;
  return (data??[]).map((row:Record<string,unknown>)=>({
    id:String(row.id),
    schoolId:String(row.school_id),
    code:String(row.code) as PolicyCode,
    name:String(row.name),
    domain:String(row.domain),
    threshold:Number((row.condition as Record<string,unknown>|null)?.threshold??0),
    actionLevel:String(row.action_level) as PolicyActionLevel,
    targetService:row.target_service?String(row.target_service) as PolicyService:undefined,
    ownerScope:String(row.owner_scope),
    enabled:Boolean(row.enabled),
    recommended:Boolean(row.recommended),
  }));
}

export async function seedRecommendedPolicies():Promise<number>{
  const client=requireClient();
  const {schoolId}=await resolveActiveSchoolContext();
  const {data,error}=await client.rpc("dreem_seed_recommended_policies",{p_school_id:schoolId});
  if(error)throw error;
  return Number(data??0);
}

export async function simulatePolicyRule(code:PolicyCode,threshold:number):Promise<{affected:number,total:number}>{
  const client=requireClient();
  const {schoolId}=await resolveActiveSchoolContext();
  const {data,error}=await client.rpc("dreem_simulate_policy_rule",{p_school_id:schoolId,p_code:code,p_threshold:threshold});
  if(error)throw error;
  const row=Array.isArray(data)?data[0]:data;
  return {affected:Number(row?.affected_count??0),total:Number(row?.total_learners??0)};
}

export async function savePolicyRule(rule:Omit<PolicyRule,"id"|"schoolId"|"recommended">):Promise<string>{
  const client=requireClient();
  const {schoolId}=await resolveActiveSchoolContext();
  const {data,error}=await client.rpc("dreem_upsert_policy_rule",{
    p_school_id:schoolId,
    p_code:rule.code,
    p_name:rule.name,
    p_domain:rule.domain,
    p_condition:{
      metric:rule.code==="attendance_followup"?"attendance_rate":rule.code==="missing_work_followup"?"missing_assignment_count":"overdue_charge_count",
      operator:rule.code==="attendance_followup"?"lt":"gte",
      threshold:rule.threshold,
    },
    p_action_level:rule.actionLevel,
    p_target_service:rule.targetService??null,
    p_owner_scope:rule.ownerScope,
    p_enabled:rule.enabled,
  });
  if(error)throw error;
  return String(data);
}


export interface PolicyFinding {
  id:string;
  title:string;
  explanation:string;
  nextAction:string;
  ownerScope:string;
  state:"open"|"acknowledged"|"resolved";
  severity:"info"|"warning"|"critical";
  domain:string;
  studentId?:string;
  lastSeenAt:string;
}

export async function loadPolicyFindings():Promise<PolicyFinding[]>{
  const client=requireClient();
  const {schoolId}=await resolveActiveSchoolContext();
  const {data,error}=await client.from("dreem_policy_findings")
    .select("id,title,explanation,next_action,owner_scope,state,severity,domain,student_id,last_seen_at")
    .eq("school_id",schoolId).in("state",["open","acknowledged"])
    .order("last_seen_at",{ascending:false}).limit(40);
  if(error)throw error;
  return (data??[]).map((row:Record<string,unknown>)=>({
    id:String(row.id),title:String(row.title),explanation:String(row.explanation),
    nextAction:String(row.next_action),ownerScope:String(row.owner_scope),
    state:String(row.state) as PolicyFinding["state"],
    severity:String(row.severity) as PolicyFinding["severity"],domain:String(row.domain),
    studentId:row.student_id?String(row.student_id):undefined,lastSeenAt:String(row.last_seen_at)
  }));
}

export async function acknowledgePolicyFinding(findingId:string,note:string):Promise<void>{
  const text=note.trim();
  if(text.length<5)throw new Error("Record what action will be taken (at least 5 characters).");
  const client=requireClient();
  const {data,error}=await client.rpc("dreem_acknowledge_policy_finding",{p_finding_id:findingId,p_note:text});
  if(error)throw error;
  if(data!==true)throw new Error("Finding could not be acknowledged. Refresh and try again.");
}
