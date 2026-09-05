import { resolveIdentityMedia } from "./identity";
import { supabase } from "./supabase";

export async function loadLearnerPhotoUrls(studentIds: string[]) {
  if (!studentIds.length) return new Map<string, string>();
  if (!supabase) throw new Error("DREEM is not connected to Supabase.");
  const { data, error } = await supabase
    .from("students")
    .select("id,photo_url")
    .in("id", studentIds);
  if (error) throw error;
  const resolved = await Promise.all((data ?? []).map(async (row) => [
    String(row.id),
    await resolveIdentityMedia(row.photo_url),
  ] as const));
  return new Map(resolved.filter((item): item is readonly [string, string] => Boolean(item[1])));
}
