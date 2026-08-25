import { type FormEvent, useMemo, useState } from "react";
import { AlertCircle, Building2, ShieldCheck } from "lucide-react";
import type { BootstrapPayload, BootstrapStatus } from "../domain/types";
import { derivePrefix, normalizeSlug } from "../domain/rules";

function errorMessage(reason: unknown) {
  if (reason instanceof Error && reason.message) return reason.message;
  if (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string") return reason.message;
  return "The founder bootstrap could not be completed. Please try again.";
}

export default function BootstrapView({ status, onBootstrap, onSignOut }:{status:BootstrapStatus;onBootstrap:(payload:BootstrapPayload)=>Promise<void>;onSignOut:()=>Promise<void>}) {
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [hasError,setHasError]=useState(false);
  const [schoolName,setSchoolName]=useState("");
  const [subsystem,setSubsystem]=useState<BootstrapPayload["subsystem"]>("bilingual");
  const slug = useMemo(()=>normalizeSlug(schoolName),[schoolName]);
  const shortName = useMemo(()=>derivePrefix(schoolName,"DRM"),[schoolName]);
  const receiptPrefix = useMemo(()=>`${derivePrefix(schoolName,"DRM")}R`,[schoolName]);
  const studentPrefix = useMemo(()=>`${derivePrefix(schoolName,"DRM")}-26`,[schoolName]);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setHasError(false);
    setMessage("Creating the first protected DREEM school...");
    try{
      await onBootstrap({
        schoolName,
        schoolSlug: slug,
        shortName,
        motto: String(new FormData(event.currentTarget).get("motto") ?? ""),
        city: String(new FormData(event.currentTarget).get("city") ?? ""),
        subsystem,
        receiptPrefix,
        studentIdPrefix: studentPrefix,
        primaryColor: "#123b2c",
        accentColor: "#c9df83",
      });
      setMessage("Founder bootstrap completed. Loading your school workspace...");
      setHasError(false);
    }catch(reason){
      setMessage(errorMessage(reason));
      setHasError(true);
    }finally{
      setBusy(false);
    }
  }

  if (status.mode === "pending" || status.mode === "rejected" || status.mode === "claimed" || status.mode === "restricted") {
    const body = status.mode === "claimed"
      ? "The first DREEM school has already been claimed. Ask an approved founder or school owner to invite this account."
      : status.mode === "pending"
        ? "Your membership exists but still needs approval before the operational workspace can open."
        : status.mode === "rejected"
          ? "This account was reviewed and is not approved for school access yet."
          : "Bootstrap is locked for this account.";
    return <div className="auth-screen"><div className="auth-card"><strong>DREEM</strong><h1>Access not ready yet</h1><p>{body}</p><div className="form-status warning"><ShieldCheck/>{status.role ? `${status.role} — ${status.status}` : status.status}</div><button onClick={onSignOut}>Sign out</button></div></div>;
  }

  return <div className="auth-screen"><form className="auth-card" onSubmit={submit}><strong>DREEM</strong><h1>Create the first school</h1><p>This founder bootstrap creates the school, approves the first platform founder, and establishes the school brand.</p><label><span>School name</span><input value={schoolName} onChange={(e)=>setSchoolName(e.target.value)} placeholder="Your school name" required/></label><label><span>Short name</span><input value={shortName} disabled/></label><label><span>Slug</span><input value={slug} disabled/></label><label><span>Subsystem</span><select value={subsystem} onChange={(e)=>setSubsystem(e.target.value as BootstrapPayload["subsystem"])}><option value="bilingual">Bilingual</option><option value="anglophone">Anglophone</option><option value="francophone">Francophone</option></select></label><label><span>Motto (optional)</span><input name="motto" placeholder="School motto"/></label><label><span>City (optional)</span><input name="city" placeholder="City"/></label>{message && <div className={`form-status ${hasError ? "error" : "success"}`}>{hasError ? <AlertCircle/> : <Building2/>}{message}</div>}<button type="submit" disabled={busy||!schoolName.trim()||!slug}>{busy?"Creating...":"Create school"}</button><button type="button" onClick={onSignOut}>Sign out</button></form></div>;
}
