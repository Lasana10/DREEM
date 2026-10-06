import { isSupabaseConfigured, supabase } from "./supabase";

export type ClassTransitionPreview={schoolId:string;fromClassName:string;toClassName:string;fromAcademicYearId?:string;toAcademicYearId:string;affectedLearners:number};

export async function previewClassTransition(fromClassId:string,toClassId:string):Promise<ClassTransitionPreview>{
  if(!fromClassId||!toClassId)throw new Error("Choose both the current class and destination class.");
  if(fromClassId===toClassId)throw new Error("Choose a different destination class.");
  if(!isSupabaseConfigured||!supabase)return{schoolId:"demo",fromClassName:"Current class",toClassName:"Next class",toAcademicYearId:"demo",affectedLearners:0};
  const{data,error}=await supabase.rpc("dreem_preview_class_transition",{p_from_class_id:fromClassId,p_to_class_id:toClassId});
  if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error("The class transition could not be previewed.");
  return{schoolId:String(row.school_id),fromClassName:String(row.from_class_name),toClassName:String(row.to_class_name),fromAcademicYearId:row.from_academic_year_id?String(row.from_academic_year_id):undefined,toAcademicYearId:String(row.to_academic_year_id),affectedLearners:Number(row.affected_learners??0)};
}

export async function executeClassTransition(input:{fromClassId:string;toClassId:string;expectedCount:number;reason:string;idempotencyKey:string}){
  if(input.expectedCount<1)throw new Error("No learner is available to move from this class.");
  if(input.reason.trim().length<5)throw new Error("Explain why this class transition is being made.");
  if(!isSupabaseConfigured||!supabase)return{movedLearners:input.expectedCount,destinationClass:"Next class",transitionKey:input.idempotencyKey};
  const{data,error}=await supabase.rpc("dreem_execute_class_transition",{p_from_class_id:input.fromClassId,p_to_class_id:input.toClassId,p_expected_count:input.expectedCount,p_reason:input.reason.trim(),p_idempotency_key:input.idempotencyKey});
  if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error("The class transition was not completed.");
  return{movedLearners:Number(row.moved_learners??0),destinationClass:String(row.destination_class),transitionKey:String(row.transition_key)};
}
