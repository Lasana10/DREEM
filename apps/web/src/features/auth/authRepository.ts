import type { AccessIdentityDraft, UserProfile } from "../../shared/types";
import { env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

type ProfileRow = {
  id: string;
  full_name: string;
  role: UserProfile["role"];
  department: string;
  matricule: string;
  school_id: string;
  access_identities?:
    | {
        email: string | null;
        phone: string | null;
        is_active: boolean;
      }
    | Array<{
        email: string | null;
        phone: string | null;
        is_active: boolean;
      }>
    | null;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: {
    provider?: string;
  };
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
  };
};

function mapProfile(row: ProfileRow): UserProfile {
  const identity = Array.isArray(row.access_identities)
    ? row.access_identities[0]
    : row.access_identities;

  return {
    id: row.id,
    name: row.full_name,
    role: row.role,
    department: row.department,
    matricule: row.matricule,
    schoolId: row.school_id,
    email: identity?.email ?? undefined,
    phone: identity?.phone ?? undefined,
    status: identity?.is_active === false ? "suspended" : "active"
  };
}

export async function loadActiveProfile(userId: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,department,matricule,school_id,access_identities(email,phone,is_active)")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw error;
  }

  return mapProfile(data as ProfileRow);
}

export async function syncNeutralProfile(user: SupabaseAuthUser) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("neutral_profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    last_provider: user.app_metadata?.provider ?? "supabase",
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  if (error) {
    throw error;
  }
}

export async function listSchoolProfiles(schoolId: string) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,department,matricule,school_id,access_identities(email,phone,is_active)")
    .eq("school_id", schoolId)
    .order("full_name");

  if (error) {
    throw error;
  }

  return (data as ProfileRow[]).map(mapProfile);
}

export async function signInWithEmail(identifier: string, password: string) {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    ...(identifier.includes("@") ? { email: identifier } : { phone: identifier }),
    password
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true as const };
}

export async function requestOtpSignIn(identifier: string) {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const normalized = identifier.trim();
  const payload = normalized.includes("@")
    ? {
        email: normalized,
        options: {
          shouldCreateUser: false,
          ...(env.appUrl ? { emailRedirectTo: env.appUrl } : {})
        }
      }
    : {
        phone: normalized,
        options: {
          shouldCreateUser: false
        }
      };

  const { error } = await supabase.auth.signInWithOtp(payload);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true as const };
}

export async function signInWithGoogle() {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      ...(env.appUrl ? { redirectTo: env.appUrl } : {})
    }
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true as const };
}

export async function provisionSchoolAccessUser(
  schoolId: string,
  draft: AccessIdentityDraft
) {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { data, error } = await supabase.functions.invoke("provision-access-user", {
    body: {
      schoolId,
      fullName: draft.fullName.trim(),
      role: draft.role,
      department: draft.department.trim(),
      matricule: draft.matricule.trim().toUpperCase(),
      email: draft.email.trim() || undefined,
      phone: draft.phone.trim() || undefined
    }
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data && typeof data === "object" && "error" in data) {
    return { ok: false, error: String(data.error) };
  }

  return { ok: true as const };
}

export async function updateSchoolUserAccessStatus(
  schoolId: string,
  userId: string,
  status: NonNullable<UserProfile["status"]>
) {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { data, error } = await supabase.functions.invoke("update-access-status", {
    body: {
      schoolId,
      userId,
      status: status === "suspended" ? "suspended" : "active"
    }
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data && typeof data === "object" && "error" in data) {
    return { ok: false, error: String(data.error) };
  }

  return { ok: true as const };
}

export async function signOutActiveSession() {
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}
