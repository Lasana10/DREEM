import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type ProvisionPayload = {
  schoolId: string;
  fullName: string;
  role:
    | "leadership"
    | "teacher"
    | "student"
    | "parent"
    | "bursar"
    | "transport"
    | "support";
  department?: string;
  matricule: string;
  email?: string;
  phone?: string;
  temporaryPassword?: string;
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

  const token = authHeader.replace("Bearer ", "");
  const admin = createClient(supabaseUrl, serviceRoleKey);

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
    return jsonResponse({ error: "Caller is not allowed to provision school users." }, 403);
  }

  let payload: ProvisionPayload;

  try {
    payload = (await request.json()) as ProvisionPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const matricule = payload.matricule.trim().toUpperCase();
  const email = payload.email?.trim().toLowerCase() || undefined;
  const phone = payload.phone?.trim() || undefined;
  const allowedRoles: ProvisionPayload["role"][] = [
    "leadership",
    "teacher",
    "student",
    "parent",
    "bursar",
    "transport",
    "support"
  ];

  if (!payload.schoolId || payload.schoolId !== callerProfile.school_id) {
    return jsonResponse({ error: "School mismatch." }, 403);
  }

  if (!payload.fullName?.trim() || !matricule) {
    return jsonResponse({ error: "Full name and matricule are required." }, 400);
  }

  if (!allowedRoles.includes(payload.role)) {
    return jsonResponse({ error: "Invalid role." }, 400);
  }

  if (!email && !phone) {
    return jsonResponse({ error: "An email or phone identifier is required." }, 400);
  }

  const existingIdentity = await admin
    .from("access_identities")
    .select("id")
    .eq("school_id", payload.schoolId)
    .eq("matricule", matricule)
    .maybeSingle();

  if (existingIdentity.data) {
    return jsonResponse({ error: "That matricule already exists." }, 409);
  }

  const authUserResult = await admin.auth.admin.createUser({
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(payload.temporaryPassword ? { password: payload.temporaryPassword } : {}),
    email_confirm: Boolean(email),
    phone_confirm: Boolean(phone),
    user_metadata: {
      full_name: payload.fullName.trim()
    },
    app_metadata: {
      school_id: payload.schoolId,
      role: payload.role,
      matricule
    }
  });

  if (authUserResult.error || !authUserResult.data.user) {
    return jsonResponse(
      { error: authUserResult.error?.message ?? "Could not create auth user." },
      400
    );
  }

  const newUser = authUserResult.data.user;

  const neutralProfileUpsert = await admin.from("neutral_profiles").upsert({
    id: newUser.id,
    email: email ?? null,
    full_name: payload.fullName.trim(),
    last_provider: email ? "email" : "phone",
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (neutralProfileUpsert.error) {
    return jsonResponse({ error: neutralProfileUpsert.error.message }, 400);
  }

  const profileUpsert = await admin.from("profiles").upsert({
    id: newUser.id,
    school_id: payload.schoolId,
    full_name: payload.fullName.trim(),
    matricule,
    role: payload.role,
    department: payload.department?.trim() ?? ""
  });

  if (profileUpsert.error) {
    return jsonResponse({ error: profileUpsert.error.message }, 400);
  }

  const membershipUpsert = await admin.from("dreem_school_memberships").upsert({
    school_id: payload.schoolId,
    profile_id: newUser.id,
    legacy_profile_id: newUser.id,
    role: payload.role,
    status: "approved",
    department: payload.department?.trim() ?? "",
    matricule,
    approved_by: caller.id,
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (membershipUpsert.error) {
    return jsonResponse({ error: membershipUpsert.error.message }, 400);
  }

  const identityUpsert = await admin.from("access_identities").upsert({
    school_id: payload.schoolId,
    profile_id: newUser.id,
    matricule,
    email: email ?? null,
    phone: phone ?? null,
    is_active: true,
    must_reset_password: Boolean(payload.temporaryPassword)
  });

  if (identityUpsert.error) {
    return jsonResponse({ error: identityUpsert.error.message }, 400);
  }

  await admin.from("access_invites").upsert({
    school_id: payload.schoolId,
    full_name: payload.fullName.trim(),
    role: payload.role,
    department: payload.department?.trim() ?? "",
    matricule,
    email: email ?? null,
    phone: phone ?? null,
    status: "sent",
    created_by: caller.id
  });

  await admin.from("audit_events").insert({
    school_id: payload.schoolId,
    actor_id: caller.id,
    action: "access.user.provisioned",
    entity_type: "profiles",
    entity_id: newUser.id,
    detail: {
      matricule,
      role: payload.role,
      email,
      phone
    }
  });

  return jsonResponse({
    ok: true,
    userId: newUser.id,
    matricule,
    email,
    phone
  });
});
