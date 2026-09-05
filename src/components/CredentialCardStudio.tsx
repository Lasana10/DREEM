import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Copy, IdCard, Printer, RefreshCw, ShieldX } from "lucide-react";
import { createIdempotencyKey } from "../domain/rules";
import { loadLearnerIdentity, revokeLearnerCredential, type LearnerIdentityProfile } from "../lib/identity";
import { issueStudentCredential, type WorkspaceData } from "../lib/repository";
import { makeQrMatrix } from "../lib/qr";
import "./CredentialCardStudio.css";

function nextYear() {
  const value = new Date();
  value.setFullYear(value.getFullYear() + 1);
  return value.toISOString().slice(0, 10);
}

function readableError(reason: unknown) {
  if (reason instanceof Error && reason.message) return reason.message;
  if (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string") return reason.message;
  return "The credential action could not be completed.";
}

function QrCode({ value }: { value: string }) {
  const matrix = useMemo(() => makeQrMatrix(value), [value]);
  const quiet = 4;
  const size = matrix.length + quiet * 2;
  return <svg className="credential-qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Learner verification QR code" shapeRendering="crispEdges">
    <rect width={size} height={size} fill="white" />
    {matrix.flatMap((row, y) => row.map((dark, x) => dark ? <rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width="1" height="1" fill="black" /> : null))}
  </svg>;
}

export default function CredentialCardStudio({ workspace, onRefresh }: { workspace: WorkspaceData; onRefresh: () => Promise<void> }) {
  const allowed = ["platform_founder", "school_owner", "principal", "administrator"].includes(workspace.viewer.role);
  const [studentId, setStudentId] = useState(workspace.learners[0]?.id ?? "");
  const [validUntil, setValidUntil] = useState(nextYear());
  const [identity, setIdentity] = useState<LearnerIdentityProfile | null>(null);
  const [verificationToken, setVerificationToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [revokeReason, setRevokeReason] = useState("Lost or replaced card");

  const load = useCallback(async () => {
    if (!studentId) { setIdentity(null); return; }
    setError("");
    try { setIdentity(await loadLearnerIdentity(studentId)); }
    catch (reason) { setError(readableError(reason)); }
  }, [studentId]);

  useEffect(() => { setVerificationToken(""); void load(); }, [load]);

  async function issue() {
    if (!studentId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await issueStudentCredential(studentId, validUntil, createIdempotencyKey("credential-card"));
      setVerificationToken(result.verificationToken);
      await load();
      await onRefresh();
      setMessage(identity?.credential ? "Previous card revoked and a new card version issued." : "Learner card issued.");
    } catch (reason) { setError(readableError(reason)); }
    finally { setBusy(false); }
  }

  async function revoke() {
    if (!studentId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const changed = await revokeLearnerCredential(studentId, revokeReason);
      setVerificationToken("");
      await load();
      await onRefresh();
      setMessage(changed ? "Active card revoked and audit evidence recorded." : "No active card was available to revoke.");
    } catch (reason) { setError(readableError(reason)); }
    finally { setBusy(false); }
  }

  if (!allowed) return <div className="content"><div className="form-status error">Card administration is restricted to authorized school administration.</div></div>;
  if (!workspace.learners.length) return <div className="content"><section className="page-intro"><div><span>IDENTITY STUDIO</span><h2>Create the first learner before issuing a card.</h2><p>Accepted admissions and approved direct enrolments create the permanent learner record used by credentials.</p></div></section></div>;

  const primaryGuardian = identity?.guardians.find((guardian) => guardian.isPrimary) ?? identity?.guardians[0];
  const isActive = identity?.credential?.status === "active";

  return <div className="content credential-studio">
    <section className="page-intro credential-card-controls"><div><span>LEARNER IDENTITY STUDIO</span><h2>Issue, print, reissue and revoke school credentials.</h2><p>The QR contains only the one-time verification secret. DREEM stores its hash, so an existing card must be reissued if its printable QR was not retained.</p></div></section>
    {error && <div className="form-status error credential-card-controls">{error}</div>}
    {message && <div className="form-status success credential-card-controls"><BadgeCheck />{message}</div>}
    <section className="panel settings-form credential-card-controls">
      <div className="form-grid">
        <label>Learner<select value={studentId} onChange={(event) => setStudentId(event.target.value)}>{workspace.learners.map((learner) => <option value={learner.id} key={learner.id}>{learner.name} · {learner.matricule}</option>)}</select></label>
        <label>Valid until<input type="date" value={validUntil} min={new Date().toISOString().slice(0,10)} onChange={(event) => setValidUntil(event.target.value)} /></label>
      </div>
      <div className="credential-actions">
        <button className="primary" type="button" disabled={busy} onClick={() => void issue()}><RefreshCw />{isActive ? "Reissue new card version" : "Issue learner card"}</button>
        {isActive && <><label>Revocation reason<input value={revokeReason} onChange={(event) => setRevokeReason(event.target.value)} /></label><button className="danger" type="button" disabled={busy} onClick={() => void revoke()}><ShieldX />Revoke active card</button></>}
      </div>
    </section>

    {identity && <section className="credential-card-sheet">
      <article className="credential-card" aria-label={`${identity.name} school identity card`}>
        <header>
          <div className="credential-school-mark">{workspace.brand.logoUrl ? <img src={workspace.brand.logoUrl} alt="" /> : workspace.brand.shortName}</div>
          <div><strong>{workspace.brand.name}</strong><small>{workspace.brand.motto}</small></div>
          <IdCard />
        </header>
        <div className="credential-card-body">
          <div className="credential-photo">{identity.photoUrl ? <img src={identity.photoUrl} alt={`${identity.name} identity`} /> : <span>{identity.name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0,3)}</span>}</div>
          <div className="credential-person"><small>STUDENT / ÉLÈVE</small><h3>{identity.name}</h3><p>{identity.matricule}</p><dl><div><dt>Class</dt><dd>{identity.className}</dd></div><div><dt>Card</dt><dd>{identity.credential?.cardNumber ?? "Not issued"}</dd></div><div><dt>Version</dt><dd>{identity.credential?.cardVersion ?? "—"}</dd></div><div><dt>Valid until</dt><dd>{identity.credential?.validUntil ?? "—"}</dd></div></dl></div>
          <div className="credential-verification">{verificationToken ? <QrCode value={verificationToken} /> : <div className="credential-qr-placeholder"><IdCard /><small>{isActive ? "Reissue to generate a new printable QR" : "Issue card to create QR"}</small></div>}<strong>{identity.credential?.status ?? "not issued"}</strong></div>
        </div>
        <footer><span>{primaryGuardian ? `Guardian: ${primaryGuardian.name} · ${primaryGuardian.relationship}` : "Guardian record held securely in DREEM"}</span><small>Scan only with an authorized DREEM gate account. This card is invalid when revoked or expired.</small></footer>
      </article>
      <div className="credential-card-controls credential-print-actions">
        <button type="button" disabled={!verificationToken} onClick={() => window.print()}><Printer />Print current card</button>
        <button type="button" disabled={!verificationToken} onClick={() => verificationToken && void navigator.clipboard?.writeText(verificationToken)}><Copy />Copy verification token</button>
      </div>
    </section>}
  </div>;
}
