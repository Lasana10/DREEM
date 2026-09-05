import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Camera, Printer, ShieldCheck, UserCheck } from "lucide-react";
import { uploadCollectorPhoto, removeIdentityMedia } from "../lib/identity";
import { authorizeLearnerCollector, type WorkspaceData } from "../lib/repository";
import { makeQrMatrix } from "../lib/qr";

function expiryDefault() {
  const value = new Date();
  value.setMonth(value.getMonth() + 6);
  return value.toISOString().slice(0, 10);
}

function errorText(reason: unknown) {
  if (reason instanceof Error && reason.message) return reason.message;
  if (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string") return reason.message;
  return "Collector authorization could not be completed.";
}

function CollectorQr({ value }: { value: string }) {
  const matrix = useMemo(() => makeQrMatrix(value), [value]);
  const quiet = 4;
  const size = matrix.length + quiet * 2;
  return <svg className="credential-qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Collector authorization QR code" shapeRendering="crispEdges">
    <rect width={size} height={size} fill="white" />
    {matrix.flatMap((row, y) => row.map((dark, x) => dark ? <rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width="1" height="1" fill="black" /> : null))}
  </svg>;
}

export default function PickupAuthorizationStudio({ workspace }: { workspace: WorkspaceData }) {
  const [studentId, setStudentId] = useState(workspace.learners[0]?.id ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [token, setToken] = useState("");
  const [authorizedName, setAuthorizedName] = useState("");
  const [authorizedRelationship, setAuthorizedRelationship] = useState("");
  const [validUntil, setValidUntil] = useState(expiryDefault());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choosePhoto(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPG, PNG or WebP collector photograph."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Collector photographs must be 5 MB or smaller."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setError("");
    setToken("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") ?? "").trim();
    const relationship = String(form.get("relationship") ?? "").trim();
    const phoneLast4 = String(form.get("phoneLast4") ?? "").trim();
    const evidenceNote = String(form.get("evidence") ?? "").trim();
    if (!photo) { setError("Take or upload the collector photograph before authorization."); return; }
    setBusy(true); setError(""); setMessage(""); setToken("");
    let storedPath = "";
    try {
      const uploaded = await uploadCollectorPhoto(studentId, photo);
      storedPath = uploaded.path;
      const result = await authorizeLearnerCollector({
        studentId,
        fullName,
        relationship,
        phoneLast4,
        photoUrl: storedPath,
        validUntil: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : undefined,
        evidenceNote,
        idempotencyKey: `collector:${crypto.randomUUID()}`,
      });
      setToken(result.collectorToken);
      setAuthorizedName(fullName);
      setAuthorizedRelationship(relationship);
      setMessage("Collector authorization saved. Print or save this QR now; only its hash is retained by DREEM.");
    } catch (reason) {
      if (storedPath) {
        try { await removeIdentityMedia(storedPath); } catch { /* Preserve the original command error. */ }
      }
      setError(errorText(reason));
    } finally { setBusy(false); }
  }

  const learner = workspace.learners.find((item) => item.id === studentId);
  return <section className="panel pickup-authorization credential-card-controls">
    <div className="panel-title"><UserCheck/><div><span>SAFE PICKUP AUTHORITY</span><h3>Authorize a collector with photograph + QR</h3><p>The gate must match the person to this record before releasing the learner.</p></div></div>
    {error && <div className="form-status error">{error}</div>}
    {message && <div className="form-status success"><ShieldCheck/>{message}</div>}
    <form className="settings-form" onSubmit={submit}>
      <div className="form-grid">
        <label>Learner<select value={studentId} onChange={(event) => { setStudentId(event.target.value); setToken(""); }}>{workspace.learners.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.matricule}</option>)}</select></label>
        <label>Collector full name<input name="fullName" minLength={3} required /></label>
        <label>Relationship<input name="relationship" required placeholder="Parent, aunt, uncle, family driver…" /></label>
        <label>Final 4 phone digits<input name="phoneLast4" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="7739" /></label>
        <label>Authorization valid until<input type="date" value={validUntil} min={new Date().toISOString().slice(0,10)} onChange={(event) => setValidUntil(event.target.value)} /></label>
        <label>Evidence / authorization note<input name="evidence" required placeholder="Guardian signed at admin desk; ID checked" /></label>
      </div>
      <div className="collector-photo-capture">
        <div className="credential-photo">{preview ? <img src={preview} alt="Collector preview" /> : <span><Camera/></span>}</div>
        <label className="primary"><Camera/>{photo ? "Retake / replace collector photo" : "Take collector photograph"}<input hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => choosePhoto(event.target.files?.[0])} /></label>
      </div>
      <button className="primary" disabled={busy} type="submit"><ShieldCheck/>{busy ? "Securing authorization…" : "Authorize collector and create QR"}</button>
    </form>
    {token && <article className="collector-pass">
      <div>{preview && <img src={preview} alt={`${authorizedName} collector`} />}</div>
      <div><small>AUTHORIZED PICKUP / RETRAIT AUTORISÉ</small><h3>{authorizedName}</h3><p>{authorizedRelationship} · {learner?.name}</p><strong>Valid until {validUntil}</strong></div>
      <CollectorQr value={token} />
      <footer><small>Scan with the DREEM Secure Gate. This authorization can be rejected at the gate if the person does not match the photograph.</small><button type="button" onClick={() => window.print()}><Printer/>Print collector pass</button></footer>
    </article>}
  </section>;
}
