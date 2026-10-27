import { resolveActiveSchoolContext } from "./schoolContext";
import { supabase } from "./supabase";
export type SavedExamPaper={
 id:string;school_id:string;class_id:string;academic_year_id:string;
 title:string;term_label:string;duration_minutes:number;question_ids:string[];
 snapshot:Array<{id:string;outcome_id:string;language:"en"|"fr";question_type:"short_answer"|"multiple_choice"|"true_false";question_text:string;choices:string[];answer_key:string;marking_guide:string;points:number}>;
 total_marks:number;created_by:string;revision:number;created_at:string;updated_at:string;
 status:"draft"|"submitted"|"approved"|"returned";review_note:string|null;
};
export async function listExamPapers():Promise<SavedExamPaper[]>{
 if(!supabase)throw new Error("School connection unavailable.");
 const context=await resolveActiveSchoolContext();
 const {data,error}=await supabase.from("dreem_exam_papers").select("id,school_id,class_id,academic_year_id,title,term_label,duration_minutes,question_ids,snapshot,total_marks,created_by,revision,created_at,updated_at,status,review_note").eq("school_id",context.schoolId).order("updated_at",{ascending:false}).limit(100);
 if(error)throw error;return(data??[]) as SavedExamPaper[];
}
export async function saveExamPaper(input:{title:string;termLabel:string;durationMinutes:number;questionIds:string[];paperId?:string}):Promise<string>{
 if(!supabase)throw new Error("School connection unavailable.");
 const {data,error}=await supabase.rpc("dreem_save_exam_paper",{p_title:input.title,p_term_label:input.termLabel,p_duration:input.durationMinutes,p_question_ids:input.questionIds,p_paper_id:input.paperId??null});
 if(error)throw error;return String(data);
}

export async function submitExamPaper(id:string){if(!supabase)throw new Error("School unavailable");const {error}=await supabase.rpc("dreem_submit_exam_paper",{p_paper_id:id});if(error)throw error;}
export async function reviewExamPaper(id:string,decision:"approved"|"returned",note:string){if(!supabase)throw new Error("School unavailable");const {error}=await supabase.rpc("dreem_review_exam_paper",{p_paper_id:id,p_decision:decision,p_note:note});if(error)throw error;}
