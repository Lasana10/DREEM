import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, BellRing, DatabaseBackup, RefreshCw, ServerCog, ShieldCheck, WifiOff } from "lucide-react";
import { loadTechnicalOperations, type AcceptanceEvidenceRow, type TechnicalStatus } from "../lib/technicalOperations";
import { releaseAlignment, type DreemReleaseManifest } from "../lib/releaseManifest";
import { userFacingError } from "../lib/userFacingError";

export default function TechnicalOperationsHome(){
  const[data,setData]=useState<{status:TechnicalStatus|null;release:DreemReleaseManifest;acceptance:AcceptanceEvidenceRow[]}|null>(null);
  const[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{setBusy(true);setError("");try{setData(await loadTechnicalOperations());}catch(reason){setError(userFacingError(reason,"Technical status could not be loaded. Nothing has been assumed healthy."));}finally{setBusy(false);}},[]);
  useEffect(()=>{void refresh();},[refresh]);
  if(!data&&!error)return <div className="content role-workspace"><section className="panel"><p>Loading technical operations…</p></section></div>;
  const status=data?.status,release=data?.release??null,alignment=releaseAlignment(release);
  const attention=(status?.failedNotifications??0)+(status?.offlineReceiptsRejected??0)+(status?.failedAcceptanceChecks??0);
  return <div className="content role-workspace technical-operations">
    <section className="role-hero"><div><span className="eyebrow">IT · TODAY</span><h2>{attention?attention+" technical item"+(attention===1?"":"s")+" need attention":"School services are clear"}</h2><p>Monitor release integrity, delivery queues, offline replay evidence and recovery readiness without receiving school-governance powers.</p></div><button className="primary" disabled={busy} onClick={()=>void refresh()}><RefreshCw/>{busy?"Refreshing…":"Refresh status"}</button></section>
    {error?<div className="form-status error" role="alert"><AlertTriangle/>{error}</div>:null}
    {status?<div className="metrics">
      <Metric label="Delivery queue" value={status.queuedNotifications} note="Queued or retrying" tone={status.queuedNotifications?"amber":""} icon={<BellRing/>}/>
      <Metric label="Delivery failures" value={status.failedNotifications} note="Provider or endpoint failures" tone={status.failedNotifications?"red":"green"} icon={<AlertTriangle/>}/>
      <Metric label="Offline rejected" value={status.offlineReceiptsRejected} note={status.offlineReceiptsAccepted+" accepted replay receipts"} tone={status.offlineReceiptsRejected?"red":"green"} icon={<WifiOff/>}/>
      <Metric label="Acceptance issues" value={status.failedAcceptanceChecks} note={status.approvedMemberships+" active school accounts"} tone={status.failedAcceptanceChecks?"red":"green"} icon={<ShieldCheck/>}/>
    </div>:null}
    <div className="focus-grid">
      <section className="focus-card"><div className="panel-title"><ServerCog/><div><span>RELEASE TRUTH</span><h3>{alignment.label}</h3><p>{release?.available?"Database and function contract reported by production.":"Production release manifest could not be verified."}</p></div></div><div className="compact-table">
        <div className="document-row"><strong>Frontend</strong><span>{release?.frontendCommit??"unstamped"}</span><small>{release?.frontendCommit==="unstamped"?"Deployment must inject VITE_DREEM_RELEASE_SHA before this can be verified.":"Frontend build carries a commit stamp."}</small></div>
        <div className="document-row"><strong>Database contract</strong><span>{release?.databaseContract??"unverified"}</span><small>{release?.releaseContract??"No release contract"}</small></div>
      </div></section>
      <section className="focus-card"><div className="panel-title"><DatabaseBackup/><div><span>RECOVERY</span><h3>Recovery evidence, not silent restore</h3><p>School leadership owns data exports. IT verifies service health and recovery evidence; destructive restore must be rehearsed in an isolated target.</p></div></div><div className="care-assurance"><ShieldCheck/><span><strong>Safe boundary</strong><small>This IT role does not gain finance, learner, admissions or safeguarding data simply because it manages technical operations.</small></span></div></section>
    </div>
    <section className="panel"><div className="panel-title"><BadgeCheck/><div><span>ACCEPTANCE EVIDENCE</span><h3>Production checks that have actually run</h3><p>These records are generated only after controlled acceptance scenarios complete or are explicitly blocked.</p></div></div><div className="compact-table">{data?.acceptance.map(item=><div className="document-row" key={item.id}><strong>{item.scenario.replaceAll("_"," ")}</strong><span className={"status-pill "+(item.status==="passed"?"success":item.status==="blocked"?"attention":"danger")}>{item.status}</span><small>{new Date(item.runAt).toLocaleString()} · {item.source}</small></div>)}{!data?.acceptance.length?<p>No persisted acceptance evidence yet.</p>:null}</div></section>
  </div>;
}
function Metric({label,value,note,tone="",icon}:{label:string;value:number;note:string;tone?:string;icon:React.ReactNode}){return <article className={"metric "+tone}><span>{icon}{label}</span><strong>{value}</strong><small>{note}</small></article>;}
