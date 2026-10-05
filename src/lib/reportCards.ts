import { isSupabaseConfigured, supabase } from "./supabase";
import { resolveActiveSchoolContext } from "./schoolContext";

export interface PublishedReportSubject {
  id: string;
  subjectId?: string;
  subjectName: string;
  averagePercent: number;
  assessmentCount: number;
}

export interface PublishedReportCardDetail {
  id: string;
  studentId: string;
  termId: string;
  status: "published";
  revision: number;
  overallAverage?: number;
  evidenceCount: number;
  teacherComment?: string;
  generatedAt: string;
  publishedAt: string;
  subjects: PublishedReportSubject[];
}

export async function loadPublishedReportCardDetail(reportCardId:string):Promise<PublishedReportCardDetail>{
  if(!reportCardId)throw new Error("Choose a published report card.");
  if(!isSupabaseConfigured||!supabase)throw new Error("Published report details require the connected school service.");
  const {schoolId}=await resolveActiveSchoolContext();
  const [{data:card,error:cardError},{data:results,error:resultsError}]=await Promise.all([
    supabase.from("dreem_report_cards").select("id,student_id,term_id,status,revision,overall_average,evidence_count,teacher_comment,generated_at,published_at").eq("school_id",schoolId).eq("id",reportCardId).eq("status","published").single(),
    supabase.from("dreem_report_card_results").select("id,subject_id,subject_name,average_percent,assessment_count").eq("school_id",schoolId).eq("report_card_id",reportCardId).order("subject_name"),
  ]);
  if(cardError)throw cardError;
  if(resultsError)throw resultsError;
  if(!card||!card.published_at)throw new Error("This report card is not available for viewing.");
  return{
    id:String(card.id),studentId:String(card.student_id),termId:String(card.term_id),status:"published",revision:Number(card.revision),
    overallAverage:card.overall_average===null?undefined:Number(card.overall_average),evidenceCount:Number(card.evidence_count),
    teacherComment:card.teacher_comment?String(card.teacher_comment):undefined,generatedAt:String(card.generated_at),publishedAt:String(card.published_at),
    subjects:(results??[]).map(row=>({id:String(row.id),subjectId:row.subject_id?String(row.subject_id):undefined,subjectName:String(row.subject_name),averagePercent:Number(row.average_percent),assessmentCount:Number(row.assessment_count)})),
  };
}
