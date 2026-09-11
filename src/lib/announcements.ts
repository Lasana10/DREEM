import { isSupabaseConfigured, supabase } from "./supabase";
import { resolveActiveSchoolContext } from "./schoolContext";

export type AnnouncementAudience = "all" | "staff" | "families" | "students";
export type AnnouncementPriority = "normal" | "important" | "urgent";
export type AnnouncementCategory = "general" | "administrative" | "academic" | "event" | "transport" | "finance" | "emergency";
export type AnnouncementPublicationStatus = "pending_approval" | "published" | "rejected" | "withdrawn";
export type SchoolAnnouncement = {
  id:string;
  title:string;
  body:string;
  audience:AnnouncementAudience;
  priority:AnnouncementPriority;
  category:AnnouncementCategory;
  publicationStatus:AnnouncementPublicationStatus;
  publishedAt?:string;
  expiresAt?:string;
};
export type AnnouncementReviewItem={
  id:string; title:string; body:string; audience:AnnouncementAudience; priority:AnnouncementPriority;
  category:AnnouncementCategory; requestedAt:string; createdBy:string;
};

export async function loadAnnouncements():Promise<SchoolAnnouncement[]> {
  if(!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("dreem_announcements")
    .select("id,title,body,audience,priority,category,publication_status,published_at,expires_at")
    .eq("publication_status","published")
    .order("published_at", { ascending:false })
    .limit(50);
  if(error) throw error;
  return (data??[]).map(row=>({
    id:String(row.id), title:String(row.title), body:String(row.body),
    audience:row.audience as AnnouncementAudience,
    priority:row.priority as AnnouncementPriority,
    category:row.category as AnnouncementCategory,
    publicationStatus:row.publication_status as AnnouncementPublicationStatus,
    publishedAt:row.published_at ? String(row.published_at) : undefined,
    expiresAt:row.expires_at ? String(row.expires_at) : undefined,
  }));
}

export async function publishAnnouncement(command:{title:string;body:string;audience:AnnouncementAudience;priority:AnnouncementPriority;category:AnnouncementCategory;expiresAt?:string}):Promise<{id:string;status:AnnouncementPublicationStatus}> {
  const title=command.title.trim(),body=command.body.trim();
  if(title.length<3) throw new Error("Add a clear announcement title.");
  if(body.length<3) throw new Error("Add the announcement message.");
  if(!isSupabaseConfigured || !supabase) return {id:crypto.randomUUID(),status:"published"};
  const context=await resolveActiveSchoolContext();
  const { data,error }=await supabase.rpc("dreem_publish_announcement_v2",{
    p_school_id:context.schoolId,
    p_title:title,
    p_body:body,
    p_audience:command.audience,
    p_priority:command.priority,
    p_category:command.category,
    p_expires_at:command.expiresAt || null,
  });
  if(error) throw error;
  const row=Array.isArray(data)?data[0]:data;
  if(!row?.announcement_id) throw new Error("Announcement was not returned by the school service.");
  return {id:String(row.announcement_id),status:String(row.publication_status) as AnnouncementPublicationStatus};
}

export async function loadAnnouncementReviewQueue():Promise<AnnouncementReviewItem[]> {
  if(!isSupabaseConfigured || !supabase) return [];
  const context=await resolveActiveSchoolContext();
  const {data,error}=await supabase.rpc("dreem_get_announcement_review_queue",{p_school_id:context.schoolId});
  if(error) throw error;
  return (data??[]).map((row:any)=>({
    id:String(row.id),title:String(row.title),body:String(row.body),
    audience:row.audience as AnnouncementAudience,priority:row.priority as AnnouncementPriority,
    category:row.category as AnnouncementCategory,requestedAt:String(row.requested_at),createdBy:String(row.created_by),
  }));
}

export async function reviewAnnouncement(id:string,decision:"approve"|"reject"):Promise<AnnouncementPublicationStatus>{
  if(!id)throw new Error("Choose an announcement to review.");
  if(!isSupabaseConfigured || !supabase)return decision==="approve"?"published":"rejected";
  const {data,error}=await supabase.rpc("dreem_review_announcement",{p_announcement_id:id,p_decision:decision});
  if(error)throw error;
  return String(data) as AnnouncementPublicationStatus;
}
