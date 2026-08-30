import { createClient } from "@supabase/supabase-js";

// These are public browser identifiers, not privileged server credentials.
// Keeping production-safe defaults prevents a Cloudflare environment-scope
// regression from locking the whole school workspace. Dashboard variables
// still take priority, so projects can override them without a code change.
const productionSupabaseUrl = "https://vlukkucwtfmfgpzvjyvd.supabase.co";
const productionPublishableKey = "sb_publishable_0gJr0-eyvR8RvXv9SmY-5A_cgLZOreU";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim() ||
  (import.meta.env.PROD ? productionSupabaseUrl : undefined);
const publishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  (import.meta.env.PROD ? productionPublishableKey : undefined);

export const isSupabaseConfigured = Boolean(supabaseUrl && publishableKey);
export const isDemoMode = import.meta.env.VITE_DREEM_DEMO_MODE === "true";

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

if (import.meta.env.PROD && !isSupabaseConfigured && !isDemoMode) {
  console.error("DREEM production configuration is incomplete. Supabase credentials are required.");
}
