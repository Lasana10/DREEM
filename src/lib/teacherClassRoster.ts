import type { LearnerSummary } from "../domain/types";
import { resolveActiveSchoolContext } from "./schoolContext";
import { isSupabaseConfigured, supabase } from "./supabase";

export async function loadTeacherClassRoster(className:string):Promise<LearnerSummary[]>{
  const clean=className.trim();if(!clean)return[];
  if(!isSupabaseConfigured||!supabase)return[];
  const context=await resolveActiveSchoolContext();
  const{data,error}=await supabase.from("students").select("id,matricule,full_name,class_name,attendance_rate,risk_level,photo_url").eq("school_id",context.schoolId).eq("class_name",clean).is("merged_into_student_id",null).order("full_name").limit(250);
  if(error)throw error;
  return(data??[]).map(row=>({
    id:String(row.id),matricule:String(row.matricule??""),name:String(row.full_name??"Learner"),className:String(row.class_name??clean),photoUrl:row.photo_url?String(row.photo_url):undefined,
    mastery:0,attendance:Number(row.attendance_rate??0),engagement:0,wellbeing:0,trend:0,nextAction:String(row.risk_level??"")==="critical"||String(row.risk_level??"")==="high"?"Review learner support":"No urgent follow-up",idStatus:"active" as const,
  }));
}
