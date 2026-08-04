import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type AccessStatusPayload = {
  schoolId: string;
  userId: string;
  status: "active" | "suspended";
};

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase server credentials." }, 500);
  }

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing bearer token." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user: caller },
    error: callerError
  } = await admin.auth.getUser(token);

  if (callerError || !caller) {
    return jsonResponse({ error: "Invalid caller session." }, 401);
  }

  const { data: callerProfile, error: profileError } = await admin
    .from("profiles")
    .select("id,school_id,role")
    .eq("id", caller.id)
    .single();

  if (profileError || !callerProfile) {
    return jsonResponse({ error: "Caller profile was not found." }, 403);
  }

  if (!["leadership", "support"].includes(callerProfile.role)) {
    return jsonResponse({ error: "Caller is not allowed to manage access status." }, 403);
  }

  let payload: AccessStatusPayload;

  try {
    payload = (await request.json()) as AccessStatusPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  if (!payload.schoolId || payload.schoolId !== callerProfile.school_id) {
    return jsonResponse({ error: "School mismatch." }, 403);
  }

  if (!payload.userId) {
    return jsonResponse({ error: "Target user is required." }, 400);
  }

  if (payload.userId === caller.id) {
    return jsonResponse({ error: "You cannot suspend or reactivate your own account." }, 400);
  }

  if (!["active", "suspended"].includes(payload.status)) {
    return jsonResponse({ error: "Invalid access status." }, 400);
  }

  const { data: targetProfile, error: targetError } = await admin
    .from("profiles")
    .select("id,school_id,role,matricule")
    .eq("id", payload.userId)
    .eq("school_id", payload.schoolId)
    .single();

  if (targetError || !targetProfile) {
    return jsonResponse({ error: "Target user was not found in this school." }, 404);
  }

  const isActive = payload.status === "active";
  const membershipStatus = isActive ? "approved" : "suspended";
  const now = new Date().toISOString();

  const { error: identityError } = await admin
    .from("access_identities")
    .update({ is_active: isActive })
    .eq("school_id", payload.schoolId)
    .eq("profile_id", payload.userId);

  if (identityError) {
    return jsonResponse({ error: identityError.message }, 400);
  }

  const { error: membershipError } = await admin
    .from("dreem_school_memberships")
    .update({ status: membershipStatus, updated_at: now })
    .eq("school_id", payload.schoolId)
    .eq("profile_id", payload.userId);

  if (membershipError) {
    return jsonResponse({ error: membershipError.message }, 400);
  }

  await admin.from("audit_events").insert({
    school_id: payload.schoolId,
    actor_id: caller.id,
    action: "access.user.status_changed",
    entity_type: "profiles",
    entity_id: payload.userId,
    detail: {
      status: payload.status,
      role: targetProfile.role,
      matricule: targetProfile.matricule
    }
  });

  return jsonResponse({
    ok: true,
    userId: payload.userId,
    status: payload.status
  });
});
