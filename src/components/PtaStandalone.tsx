import { useEffect, useState } from "react";
import AuthGate from "./AuthGate";
import PtaStaffWorkspace from "./PtaStaffWorkspace";
import { resolveActiveSchoolContext } from "../lib/schoolContext";
import { supabase } from "../lib/supabase";
import { userFacingError } from "../lib/userFacingError";
import "./PtaStandalone.css";

function PtaLeadership() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await resolveActiveSchoolContext();
        if (!supabase) throw new Error("School service unavailable");
        const { error } = await supabase.rpc("dreem_pta_staff_campaigns");
        if (error) throw error;
        if (active) setState("ready");
      } catch (reason) {
        if (active) {
          setMessage(userFacingError(reason, "Your school access could not be verified."));
          setState("error");
        }
      }
    })();
    return () => { active = false; };
  }, []);
  return <main className="pta-standalone">
    <header className="pta-admin-header">
      <a className="pta-admin-logo" href="/pta"><span>D</span><span><strong>DREEM</strong><small>PTA / APEE · SCHOOL MANAGEMENT</small></span></a>
      <nav aria-label="PTA navigation"><a href="/pta">Parent portal</a><a href="/">School OS</a><button type="button" onClick={() => void supabase?.auth.signOut()}>Sign out</button></nav>
    </header>
    <div className="pta-admin-container">
      {state === "loading" && <section className="pta-admin-state" role="status">Checking your school leadership access…</section>}
      {state === "error" && <section className="pta-admin-state"><h1>Leadership access could not be confirmed</h1><p>{message}</p><p>If you belong to several schools, choose your school in DREEM before returning here.</p><a href="/">Open school selection</a><button type="button" onClick={() => window.location.reload()}>Retry</button></section>}
      {state === "ready" && <PtaStaffWorkspace />}
    </div>
  </main>;
}

export function PtaStandaloneAdmin() {
  return <AuthGate><PtaLeadership /></AuthGate>;
}

export function PtaStandaloneHome() {
  return <main className="pta-standalone">
    <header className="pta-admin-header"><a className="pta-admin-logo" href="/pta"><span>D</span><span><strong>DREEM</strong><small>PTA / APEE · PARENTS & SCHOOL</small></span></a><nav><a href="/pta/admin">School management</a></nav></header>
    <section className="pta-landing-hero">
      <span className="pta-landing-eyebrow">PARENT VOICE · PTA / APEE</span>
      <h1>A stronger school starts with listening.</h1>
      <p>Share your questions, concerns and suggestions before the next Parent–Teacher Association meeting. / Exprimez vos questions, préoccupations et propositions avant la prochaine réunion APEE.</p>
      <div className="pta-landing-actions"><a href="/pta/admin">School leadership · Gestion scolaire</a></div>
    </section>
    <section className="pta-landing-info"><h2>For parents · Pour les parents</h2><p>Your school will send you a specific consultation link. Open that link to submit your feedback in English or French. No account, password or CAPTCHA is needed.</p><p>Votre école vous communiquera un lien de consultation. Ouvrez ce lien pour donner votre avis en français ou en anglais, sans compte ni CAPTCHA.</p><p>For emergencies or child-protection concerns, contact school officials directly. / En cas d'urgence ou de danger pour un enfant, contactez directement l'établissement.</p></section>
  </main>;
}
