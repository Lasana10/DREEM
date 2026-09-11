import { isSupabaseConfigured, supabase } from "./supabase";

export type AnnouncementAudience = "all" | "staff" | "families" | "students";
export type AnnouncementPriority = "normal" | "important" | "urgent";
export type SchoolAnnouncement = {
  id:string;
  title:string;
  body:string;
  audience:AnnouncementAudience;
  priority:AnnouncementPriority;
  publishedAt:string;
  expiresAt?:string;
};

export async function loadAnnouncements():Promise<SchoolAnnouncement[]> {
  if(!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("dreem_announcements")
    .select("id,title,body,audience,priority,published_at,expires_at")
    .order("published_at", { ascending:false })
    .limit(50);
  if(error) throw error;
  return (data??[]).map(row=>({
    id:String(row.id), title:String(row.title), body:String(row.body),
    audience:row.audience as AnnouncementAudience,
    priority:row.priority as AnnouncementPriority,
    publishedAt:String(row.published_at),
    expiresAt:row.expires_at ? String(row.expires_at) : undefined,
  }));
}

export async function publishAnnouncement(command:{title:string;body:string;audience:AnnouncementAudience;priority:AnnouncementPriority;expiresAt?:string}):Promise<string> {
  const title=command.title.trim(),body=command.body.trim();
  if(title.length<3) throw new Error("Add a clear announcement title.");
  if(body.length<3) throw new Error("Add the announcement message.");
  if(!isSupabaseConfigured || !supabase) return crypto.randomUUID();
  const { data,error }=await supabase.rpc("dreem_publish_announcement",{
    p_title:title,
    p_body:body,
    p_audience:command.audience,
    p_priority:command.priority,
    p_expires_at:command.expiresAt || null,
  });
  if(error) throw error;
  if(!data) throw new Error("Announcement was not returned by the school service.");
  return String(data);
}
