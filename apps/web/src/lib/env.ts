export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabasePublishableKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    "",
  appUrl: import.meta.env.VITE_APP_URL ?? "",
  workerUrl: import.meta.env.VITE_WORKER_URL ?? "",
  demoMode: (import.meta.env.VITE_DEMO_MODE ?? "true") === "true"
};

export function hasSupabaseConfig() {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}
