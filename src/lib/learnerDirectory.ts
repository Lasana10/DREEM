import type { LearnerSummary } from "../domain/types";
import { resolveActiveSchoolContext } from "./schoolContext";
import { isSupabaseConfigured, supabase } from "./supabase";

export type LearnerDirectoryPage={rows:LearnerSummary[];total:number;page:number;pageSize:number};

function cleanSearch(value:string){return value.trim().replace(/[%_,()]/g," ").replace(/\s+/g," ").slice(0,80);}
function number(value:unknown,fallback=0){const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;}

export async function loadLearnerDirectoryPage(input:{page?:number;pageSize?:number;query?:string}={}):Promise<LearnerDirectoryPage>{
  const page=Math.max(0,Math.floor(input.page??0)),pageSize=Math.min(100,Math.max(20,Math.floor(input.pageSize??50)));
  if(!isSupabaseConfigured||!supabase)return{rows:[],total:0,page,pageSize};
  const context=await resolveActiveSchoolContext(),from=page*pageSize,to=from+pageSize-1,query=cleanSearch(input.query??"");
  let students=supabase.from("students").select("id,matricule,full_name,class_name,attendance_rate,risk_level,photo_url",{count:"exact"}).eq("school_id",context.schoolId).is("merged_into_student_id",null).order("full_name").range(from,to);
  if(query){const term=`%${query}%`;students=students.or(`full_name.ilike.${term},matricule.ilike.${term},class_name.ilike.${term}`);}
  const studentResult=await students;if(studentResult.error)throw studentResult.error;
  const studentRows=studentResult.data??[],ids=studentRows.map(row=>String(row.id));
  if(!ids.length)return{rows:[],total:studentResult.count??0,page,pageSize};
  const [growthResult,feeResult,credentialResult,interventionResult]=await Promise.all([
    supabase.from("dreem_growth_snapshots").select("student_id,mastery,engagement,wellbeing,trend,snapshot_date").eq("school_id",context.schoolId).in("student_id",ids).order("snapshot_date",{ascending:false}),
    supabase.from("fee_accounts").select("id,student_id,balance_due").eq("school_id",context.schoolId).in("student_id",ids),
    supabase.from("dreem_student_credentials").select("student_id,status,issued_at").eq("school_id",context.schoolId).in("student_id",ids).order("issued_at",{ascending:false}),
    supabase.from("dreem_interventions").select("student_id,title,status,review_on").eq("school_id",context.schoolId).in("student_id",ids).not("status","in","(closed,cancelled)").order("review_on"),
  ]);
  for(const result of [growthResult,feeResult,credentialResult,interventionResult])if(result.error)throw result.error;
  const growth=new Map<string,Record<string,unknown>>();for(const row of growthResult.data??[])if(!growth.has(String(row.student_id)))growth.set(String(row.student_id),row);
  const fees=new Map((feeResult.data??[]).map(row=>[String(row.student_id),row]));
  const credentials=new Map<string,Record<string,unknown>>();for(const row of credentialResult.data??[])if(!credentials.has(String(row.student_id)))credentials.set(String(row.student_id),row);
  const interventions=new Map<string,Record<string,unknown>>();for(const row of interventionResult.data??[])if(!interventions.has(String(row.student_id)))interventions.set(String(row.student_id),row);
  const rows:LearnerSummary[]=studentRows.map(student=>{
    const id=String(student.id),g=growth.get(id),fee=fees.get(id),credential=credentials.get(id),intervention=interventions.get(id),risk=String(student.risk_level??"normal");
    return{
      id,matricule:String(student.matricule??""),name:String(student.full_name??"Learner"),className:String(student.class_name??"Unassigned"),photoUrl:student.photo_url?String(student.photo_url):undefined,
      mastery:number(g?.mastery),attendance:number(student.attendance_rate),engagement:number(g?.engagement),wellbeing:number(g?.wellbeing),trend:number(g?.trend),
      nextAction:intervention?.title?String(intervention.title):risk==="high"||risk==="critical"?"Review learner support":"No urgent follow-up",
      idStatus:(credential?.status==="revoked"?"revoked":credential?.status==="expired"?"expired":"active") as LearnerSummary["idStatus"],
      feeAccountId:fee?.id?String(fee.id):undefined,feeBalance:fee?.balance_due===undefined?undefined:number(fee.balance_due),
    };
  });
  return{rows,total:studentResult.count??rows.length,page,pageSize};
}
