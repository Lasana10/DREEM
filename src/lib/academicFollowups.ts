import {resolveActiveSchoolContext} from "./schoolContext";
import {supabase} from "./supabase";
export type AcademicFollowup={
 id:string;school_id:string;register_id:string;marking_check_id:string|null;
 assigned_teacher:string;title:string;required_action:string;due_date:string;
 status:"open"|"responded"|"returned"|"closed";created_by:string;created_at:string;
 response:string|null;response_evidence:string|null;responded_at:string|null;
 review_note:string|null;reviewed_by:string|null;reviewed_at:string|null;closed_at:string|null;
};
export async function listAcademicFollowups():Promise<AcademicFollowup[]>{
 if(!supabase)throw new Error("School connection unavailable.");
 const {schoolId}=await resolveActiveSchoolContext();
 const {data,error}=await supabase.from("dreem_academic_followups")
  .select("id,school_id,register_id,marking_check_id,assigned_teacher,title,required_action,due_date,status,created_by,created_at,response,response_evidence,responded_at,review_note,reviewed_by,reviewed_at,closed_at")
  .eq("school_id",schoolId).order("due_date",{ascending:true}).limit(200);
 if(error)throw error;return(data??[]) as AcademicFollowup[];
}
export async function openAcademicFollowup(input:{registerId:string;markingCheckId?:string;title:string;action:string;dueDate:string}):Promise<string>{
 if(!supabase)throw new Error("School connection unavailable.");
 const {data,error}=await supabase.rpc("dreem_open_academic_followup",{
  p_register_id:input.registerId,p_marking_check_id:input.markingCheckId??null,
  p_title:input.title,p_action:input.action,p_due_date:input.dueDate
 });
 if(error)throw error;return String(data);
}
export async function respondAcademicFollowup(id:string,response:string,evidence:string){
 if(!supabase)throw new Error("School connection unavailable.");
 const {error}=await supabase.rpc("dreem_respond_academic_followup",{
  p_followup_id:id,p_response:response,p_evidence:evidence
 });if(error)throw error;
}
export async function reviewAcademicFollowup(id:string,decision:"closed"|"returned",note:string){
 if(!supabase)throw new Error("School connection unavailable.");
 const {error}=await supabase.rpc("dreem_review_academic_followup",{
  p_followup_id:id,p_decision:decision,p_note:note
 });if(error)throw error;
}
