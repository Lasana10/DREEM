import { resolveActiveSchoolContext } from "./schoolContext";
import { supabase } from "./supabase";

export type QuestionItem={
 id:string;school_id:string;outcome_id:string;language:"en"|"fr";
 question_type:"short_answer"|"multiple_choice"|"true_false";
 difficulty:"foundation"|"intermediate"|"advanced";question_text:string;
 choices:string[];answer_key:string;marking_guide:string;points:number;source_reference:string;
 status:"draft"|"submitted"|"approved"|"returned";created_by:string;review_note:string|null;
};
export type QuestionDraft={
 outcomeId:string;language:QuestionItem["language"];questionType:QuestionItem["question_type"];
 difficulty:QuestionItem["difficulty"];questionText:string;choices:string[];
 answerKey:string;markingGuide:string;points:number;sourceReference:string;questionId?:string;
};
function client(){if(!supabase)throw new Error("School service is unavailable");return supabase;}
export async function fetchQuestionBank(){
 const school=await resolveActiveSchoolContext();
 const {data,error}=await client().from("dreem_question_bank").select("id,school_id,outcome_id,language,question_type,difficulty,question_text,choices,answer_key,marking_guide,points,source_reference,status,created_by,review_note").eq("school_id",school.schoolId).order("created_at",{ascending:false}).limit(300);
 if(error)throw error;return(data??[]) as QuestionItem[];
}
export async function saveQuestionDraft(draft:QuestionDraft){
 const {data,error}=await client().rpc("dreem_save_question",{
 p_outcome_id:draft.outcomeId,p_language:draft.language,p_type:draft.questionType,
 p_difficulty:draft.difficulty,p_question:draft.questionText,p_choices:draft.choices,
 p_answer:draft.answerKey,p_marking_guide:draft.markingGuide,p_points:draft.points,
 p_source:draft.sourceReference,p_question_id:draft.questionId??null
 });
 if(error)throw error;return data as string;
}
export async function submitQuestion(id:string){
 const {error}=await client().rpc("dreem_submit_question",{p_question_id:id});if(error)throw error;
}
export async function reviewQuestion(id:string,decision:"approved"|"returned",note:string){
 const {error}=await client().rpc("dreem_review_question",{p_question_id:id,p_decision:decision,p_note:note});if(error)throw error;
}
