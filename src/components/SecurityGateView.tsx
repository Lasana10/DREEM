import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, ScanLine, ShieldCheck, UserCheck, XCircle } from "lucide-react";
import { resolveIdentityMedia } from "../lib/identity";
import { verifyLearnerRelease } from "../lib/repository";
import "./SecurityGateView.css";

type ScanTarget = "learner" | "collector";
type BarcodeResult = { rawValue?: string };
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<BarcodeResult[]> };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;

type ReleaseResult = {
  decision: string;
  studentId: string;
  studentName: string;
  matricule: string;
  collectorName: string;
  collectorPhotoUrl: string;
};

function errorText(reason: unknown) {
  if (reason instanceof Error && reason.message) return reason.message;
  if (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string") return reason.message;
  return "Gate verification could not be completed.";
}

export default function SecurityGateView({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanGeneration = useRef(0);
  const [learnerToken, setLearnerToken] = useState("");
  const [collectorToken, setCollectorToken] = useState("");
  const [scanTarget, setScanTarget] = useState<ScanTarget | null>(null);
  const [decision, setDecision] = useState<"released" | "denied">("released");
  const [reason, setReason] = useState("Identity and collection authority verified at gate");
  const [result, setResult] = useState<ReleaseResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function stopScanner() {
    scanGeneration.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanTarget(null);
  }

  useEffect(() => () => {
    scanGeneration.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startScanner(target: ScanTarget) {
    setError(""); setMessage(""); setResult(null);
    stopScanner();
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera QR scanning is not supported by this browser. Enter or paste the credential below instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach((track) => track.stop()); return; }
      video.srcObject = stream;
      await video.play();
      const detector = new Detector({ formats: ["qr_code"] });
      const generation = scanGeneration.current + 1;
      scanGeneration.current = generation;
      setScanTarget(target);
      const scan = async () => {
        if (scanGeneration.current !== generation || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes.find((code) => code.rawValue?.trim())?.rawValue?.trim();
          if (value) {
            if (target === "learner") setLearnerToken(value); else setCollectorToken(value);
            setMessage(target === "learner" ? "Learner card scanned. Scan the approved collector next." : "Collector credential scanned. Verify the person, then record the gate decision.");
            stopScanner();
            return;
          }
        } catch {
          // Some devices briefly fail detection while the camera refocuses; continue scanning.
        }
        if (scanGeneration.current === generation) window.requestAnimationFrame(() => void scan());
      };
      void scan();
    } catch (reasonValue) {
      stopScanner();
      setError(errorText(reasonValue));
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage(""); setResult(null); stopScanner();
    try {
      if (!learnerToken.trim()) throw new Error("Scan or enter the learner credential first.");
      if (decision === "released" && !collectorToken.trim()) throw new Error("A valid collector credential is required before release.");
      if (!reason.trim()) throw new Error("Record a gate verification note.");
      const saved = await verifyLearnerRelease({
        credentialToken: learnerToken.trim(),
        collectorToken: collectorToken.trim(),
        decision,
        reason: reason.trim(),
        idempotencyKey: `learner-release:${crypto.randomUUID()}`,
      });
      const collectorPhotoUrl = saved.collectorPhotoUrl ? await resolveIdentityMedia(saved.collectorPhotoUrl) : undefined;
      setResult({ ...saved, collectorPhotoUrl: collectorPhotoUrl ?? "" });
      setMessage(saved.decision === "released" ? "Release verified and written to the safeguarding audit trail." : "Release denied and written to the safeguarding audit trail.");
      await onRefresh();
      if (saved.decision === "released") { setLearnerToken(""); setCollectorToken(""); }
    } catch (reasonValue) { setError(errorText(reasonValue)); }
    finally { setBusy(false); }
  }

  return <div className="content gate-app">
    <section className="page-intro"><div><span>DREEM SECURE GATE</span><h2>Scan. Match. Release—or deny.</h2><p>This account cannot edit learners, routes, finance or school setup. Every completed decision is recorded as safeguarding evidence.</p></div><div className="care-assurance"><ShieldCheck/><span><strong>Two-factor physical handover</strong><small>Learner card + approved collector credential.</small></span></div></section>
    {error && <div className="form-status error"><XCircle />{error}</div>}
    {message && <div className="form-status success"><ShieldCheck />{message}</div>}
    <div className="gate-grid">
      <section className="panel gate-scanner"><div className="panel-title"><ScanLine/><div><span>CAMERA SCANNER</span><h3>{scanTarget ? `Scanning ${scanTarget} QR…` : "Ready to scan"}</h3></div></div><div className={`gate-camera ${scanTarget ? "active" : ""}`}><video ref={videoRef} muted playsInline aria-label="Gate QR camera preview" />{!scanTarget && <div><Camera/><span>Camera opens only when you tap Scan.</span></div>}</div><div className="gate-scan-actions"><button type="button" className="primary" onClick={() => void startScanner("learner")}><ScanLine/>Scan learner card</button><button type="button" onClick={() => void startScanner("collector")}><UserCheck/>Scan collector</button>{scanTarget && <button type="button" onClick={stopScanner}>Stop camera</button>}</div></section>
      <form className="panel settings-form" onSubmit={submit}><div className="panel-title"><ShieldCheck/><div><span>HANDOVER DECISION</span><h3>Confirm both identities</h3></div></div><label>Learner credential<input value={learnerToken} onChange={(event) => setLearnerToken(event.target.value)} autoComplete="off" placeholder="Scan or paste learner token" /></label><label>Collector credential<input value={collectorToken} onChange={(event) => setCollectorToken(event.target.value)} autoComplete="off" placeholder="Required to release learner" /></label><label>Decision<select value={decision} onChange={(event) => setDecision(event.target.value as "released"|"denied")}><option value="released">Release learner</option><option value="denied">Deny release</option></select></label><label>Verification note<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="primary" disabled={busy} type="submit"><ShieldCheck/>{busy ? "Verifying…" : "Verify and record decision"}</button></form>
    </div>
    {result && <section className={`gate-result ${result.decision === "released" ? "released" : "denied"}`}>{result.collectorPhotoUrl && <img src={result.collectorPhotoUrl} alt="Verified collector"/>}<div><span>{result.decision === "released" ? "RELEASE AUTHORIZED" : "DO NOT RELEASE"}</span><h3>{result.studentName}</h3><p>{result.matricule}</p><strong>{result.collectorName}</strong></div></section>}
  </div>;
}
