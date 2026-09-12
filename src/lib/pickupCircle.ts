import { isSupabaseConfigured, supabase } from "./supabase";

export type PickupCircleMember = {
  collectorId: string;
  fullName: string;
  relationship: string;
  phoneLast4: string;
  photoUrl: string;
  validFrom: string;
  validUntil: string;
  status: "active" | "suspended" | "revoked" | "expired";
  lastDecision: string;
  lastReleaseAt: string;
};

export async function loadPickupCircle(studentId: string): Promise<PickupCircleMember[]> {
  if (!studentId || !isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc("dreem_get_pickup_circle", { p_student_id: studentId });
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    collectorId: String(row.collector_id),
    fullName: String(row.full_name ?? ""),
    relationship: String(row.relationship ?? ""),
    phoneLast4: String(row.phone_last4 ?? ""),
    photoUrl: String(row.photo_url ?? ""),
    validFrom: String(row.valid_from ?? ""),
    validUntil: String(row.valid_until ?? ""),
    status: String(row.collector_status) as PickupCircleMember["status"],
    lastDecision: String(row.last_decision ?? ""),
    lastReleaseAt: String(row.last_release_at ?? ""),
  }));
}

export async function setPickupCircleMemberStatus(collectorId: string, status: "active" | "suspended" | "revoked", reason: string) {
  if (!collectorId || !reason.trim()) throw new Error("Collector and reason are required.");
  if (!isSupabaseConfigured || !supabase) return { collectorId, status };
  const { data, error } = await supabase.rpc("dreem_set_collector_status", {
    p_collector_id: collectorId,
    p_status: status,
    p_reason: reason.trim(),
    p_idempotency_key: `pickup-circle:${crypto.randomUUID()}`,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { collectorId: String(row.collector_id), status: String(row.collector_status) };
}
