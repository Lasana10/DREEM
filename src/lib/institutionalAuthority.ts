import type { AuthorityScope } from "./authority";
import { resolveActiveSchoolContext } from "./schoolContext";
import { supabase } from "./supabase";

export type PositionCategory="governance"|"leadership"|"academic"|"finance"|"operations"|"support"|"audit";
export type SchoolPosition={
  id:string;
  code:string;
  title:string;
  category:PositionCategory;
  active:boolean;
  scopes:AuthorityScope[];
};
export type PositionAssignment={
  id:string;
  membershipId:string;
  positionId:string;
  primary:boolean;
  status:"active"|"suspended"|"ended";
};

export const authorityScopeOptions:{value:AuthorityScope;label:string;description:string}[]=[
  {value:"institutional_leadership",label:"Institutional leadership",description:"Whole-school command, exceptions and accountable oversight."},
  {value:"academics",label:"Academics",description:"Curriculum, teaching, assessment and academic review."},
  {value:"admissions",label:"Admissions",description:"Application, decision, enrolment and learner intake."},
  {value:"finance_collection",label:"Finance collection",description:"Collect, receipt, close till and execute approved payouts."},
  {value:"finance_approval",label:"Finance approval",description:"Review, reconcile, approve refunds and settlement."},
  {value:"safeguarding",label:"Safeguarding",description:"Protected learner concerns and confidential case action."},
  {value:"transport",label:"Transport",description:"Routes, vehicles, dispatch, trips and transport exceptions."},
  {value:"gate",label:"Gate & release",description:"Credential checks and safe learner release."},
  {value:"staff_management",label:"Staff management",description:"Membership approval, appointments and delegation."},
  {value:"communications",label:"Communications",description:"Official notices, audiences and operational messaging."},
  {value:"audit",label:"Audit",description:"Independent evidence and control review."},
  {value:"school_configuration",label:"School configuration",description:"Institution structure, policies and operating setup."},
];

export const positionPresets:{title:string;category:PositionCategory;scopes:AuthorityScope[]}[]=[
  {title:"Owner / Proprietor",category:"governance",scopes:["institutional_leadership","finance_approval","staff_management","communications","audit","school_configuration"]},
  {title:"Principal / Head of School",category:"leadership",scopes:["institutional_leadership","academics","admissions","safeguarding","transport","staff_management","communications","school_configuration"]},
  {title:"Headmaster / Headmistress",category:"leadership",scopes:["institutional_leadership","academics","admissions","safeguarding","staff_management","communications","school_configuration"]},
  {title:"Director",category:"leadership",scopes:["institutional_leadership","academics","admissions","staff_management","communications","school_configuration"]},
  {title:"Dean / Academic Head",category:"academic",scopes:["academics","admissions","communications"]},
  {title:"Registrar / Admissions Lead",category:"operations",scopes:["admissions","communications"]},
  {title:"Bursar / Cashier",category:"finance",scopes:["finance_collection"]},
  {title:"Accountant / Finance Reviewer",category:"finance",scopes:["finance_approval","audit"]},
  {title:"Safeguarding Lead",category:"support",scopes:["safeguarding"]},
  {title:"Transport Manager",category:"operations",scopes:["transport","communications"]},
  {title:"Gate / Security Lead",category:"operations",scopes:["gate"]},
  {title:"Auditor",category:"audit",scopes:["audit"]},
];

function requireSupabase(){if(!supabase)throw new Error("DREEM institutional authority is unavailable.");return supabase;}

export async function loadInstitutionAuthority():Promise<{positions:SchoolPosition[];assignments:PositionAssignment[]}>{
  const db=requireSupabase();
  const {schoolId}=await resolveActiveSchoolContext();
  const [positionsResult,scopeResult,assignmentResult]=await Promise.all([
    db.from("dreem_school_positions").select("id,code,title,category,is_active").eq("school_id",schoolId).order("category").order("title"),
    db.from("dreem_position_authorities").select("position_id,scope"),
    db.from("dreem_position_assignments").select("id,membership_id,position_id,is_primary,status").eq("school_id",schoolId).order("created_at"),
  ]);
  if(positionsResult.error)throw positionsResult.error;
  if(scopeResult.error)throw scopeResult.error;
  if(assignmentResult.error)throw assignmentResult.error;
  const scopes=new Map<string,AuthorityScope[]>();
  for(const row of scopeResult.data??[]){
    const id=String(row.position_id),current=scopes.get(id)??[];
    current.push(String(row.scope) as AuthorityScope);scopes.set(id,current);
  }
  return{
    positions:(positionsResult.data??[]).map(row=>({id:String(row.id),code:String(row.code),title:String(row.title),category:String(row.category) as PositionCategory,active:Boolean(row.is_active),scopes:scopes.get(String(row.id))??[]})),
    assignments:(assignmentResult.data??[]).map(row=>({id:String(row.id),membershipId:String(row.membership_id),positionId:String(row.position_id),primary:Boolean(row.is_primary),status:String(row.status) as PositionAssignment["status"]})),
  };
}

export async function upsertSchoolPosition(input:{id?:string;code:string;title:string;category:PositionCategory;scopes:AuthorityScope[]}){
  const db=requireSupabase();const{schoolId}=await resolveActiveSchoolContext();
  const{data,error}=await db.rpc("dreem_upsert_school_position",{p_school_id:schoolId,p_position_id:input.id??null,p_code:input.code,p_title:input.title,p_category:input.category,p_scopes:input.scopes});
  if(error)throw error;return String(data);
}

export async function assignSchoolPosition(input:{membershipId:string;positionId:string;primary:boolean}){
  const db=requireSupabase();const{schoolId}=await resolveActiveSchoolContext();
  const{data,error}=await db.rpc("dreem_assign_school_position",{p_school_id:schoolId,p_membership_id:input.membershipId,p_position_id:input.positionId,p_is_primary:input.primary});
  if(error)throw error;return String(data);
}

export async function endSchoolPositionAssignment(assignmentId:string){
  const db=requireSupabase();const{schoolId}=await resolveActiveSchoolContext();
  const{error}=await db.rpc("dreem_end_school_position_assignment",{p_school_id:schoolId,p_assignment_id:assignmentId});
  if(error)throw error;
}
