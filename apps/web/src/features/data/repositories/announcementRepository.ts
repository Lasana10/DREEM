import { starterAnnouncements } from "../../../shared/data";
import type { Announcement, UserProfile } from "../../../shared/types";
import { env } from "../../../lib/env";
import { supabase } from "../../../lib/supabase";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audience: string;
  category: string;
  created_at: string;
  school_id: string;
  profiles?: { full_name: string } | { full_name: string }[] | null;
};

function getAuthorName(profile: AnnouncementRow["profiles"]) {
  if (Array.isArray(profile)) {
    return profile[0]?.full_name ?? "School staff";
  }

  return profile?.full_name ?? "School staff";
}

function mapAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience as Announcement["audience"],
    category: row.category as Announcement["category"],
    author: getAuthorName(row.profiles),
    createdAt: new Date(row.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    }),
    schoolId: row.school_id
  };
}

export async function listAnnouncements(activeUser: UserProfile) {
  if (env.demoMode || !supabase || !activeUser.schoolId) {
    return starterAnnouncements;
  }

  const { data, error } = await supabase
    .from("announcements")
    .select("id,title,body,audience,category,created_at,school_id,profiles:author_id(full_name)")
    .eq("school_id", activeUser.schoolId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as unknown as AnnouncementRow[]).map(mapAnnouncement);
}

export async function createAnnouncementRecord(
  announcement: Announcement,
  activeUser: UserProfile
) {
  if (env.demoMode || !supabase || !activeUser.schoolId) {
    return announcement;
  }

  const { data, error } = await supabase
    .from("announcements")
    .insert({
      school_id: activeUser.schoolId,
      author_id: activeUser.id,
      title: announcement.title,
      body: announcement.body,
      audience: announcement.audience,
      category: announcement.category
    })
    .select("id,title,body,audience,category,created_at,school_id,profiles:author_id(full_name)")
    .single();

  if (error) {
    throw error;
  }

  return mapAnnouncement(data as unknown as AnnouncementRow);
}
