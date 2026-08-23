import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isDemoMode, isSupabaseConfigured, supabase } from "../lib/supabase";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"sign-in" | "activate">("sign-in");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("Signing in…");
    const values = new FormData(event.currentTarget);
    const { error } = await supabase!.auth.signInWithPassword({ email:String(values.get("email")), password:String(values.get("password")) });
    setMessage(error ? error.message : "Signed in.");
  }

  async function activateFounder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Creating your protected founder account…");
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    const { data, error } = await supabase!.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(data.session
      ? "Founder account activated."
      : "Check your email to confirm the account, then return and sign in.");
    if (!data.session) setMode("sign-in");
  }

  if (!ready) return <div className="auth-screen"><div className="auth-card"><strong>DREEM</strong><p>Securing your school workspace…</p></div></div>;
  if (!isSupabaseConfigured && isDemoMode) return <>{children}<div className="demo-banner">Demo workspace · no real school records are being used</div></>;
  if (!isSupabaseConfigured) return <div className="auth-screen"><div className="auth-card"><strong>DREEM</strong><h1>Configuration required</h1><p>This deployment is not connected to the authorised DREEM Supabase project.</p></div></div>;
  if (!session) return <div className="auth-screen"><form className="auth-card" onSubmit={mode === "activate" ? activateFounder : signIn}><span>D</span><strong>DREEM</strong><h1>{mode === "activate" ? "Activate the founder account" : "Enter your school workspace"}</h1><p>{mode === "activate" ? "Only the protected founder email authorised in DREEM can create the first school." : "Use the staff, parent or learner account issued by your school."}</p><label>Email<input type="email" name="email" required autoComplete="email" /></label><label>Password<input type="password" name="password" required minLength={8} autoComplete={mode === "activate" ? "new-password" : "current-password"} /></label>{message && <small>{message}</small>}<button type="submit">{mode === "activate" ? "Activate founder securely" : "Sign in securely"}</button><button type="button" onClick={() => { setMessage(""); setMode(current => current === "sign-in" ? "activate" : "sign-in"); }}>{mode === "activate" ? "Return to sign in" : "First founder? Activate account"}</button></form></div>;
  return <>{children}</>;
}
