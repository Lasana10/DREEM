import type {
  BackupJobRecord,
  StorageConnection,
  WorkerBackupTopology
} from "../../shared/types";

export function StorageStrategyPanel({
  storageConnections,
  backupTopology,
  backupJobs = []
}: {
  storageConnections: StorageConnection[];
  backupTopology?: WorkerBackupTopology | null;
  backupJobs?: BackupJobRecord[];
}) {
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">Storage strategy</span>
          <h2>Cloud, OneDrive, and local resilience</h2>
        </div>
      </div>

      <div className="feed-list">
        {storageConnections.map((connection) => (
          <article key={connection.provider} className="feed-card">
            <div className="feed-meta">
              <span className="feed-tag">{connection.provider}</span>
              <span>{connection.status}</span>
            </div>
            <h3>{connection.label}</h3>
            <p>{connection.purpose}</p>
          </article>
        ))}
      </div>

      <div className="config-band">
        <div>
          <span className="eyebrow">Backup topology</span>
          <h3>Supabase primary, R2 replica, B2 cold backup, OneDrive school copy</h3>
          <p>
            Secrets remain in the Render worker. The browser only receives readiness and bucket labels.
          </p>
        </div>
        <div className="action-row">
          <span className="module-chip">
            {backupTopology?.ready ? "Backup lane ready" : "Awaiting worker/env verification"}
          </span>
          <span className="module-chip">
            {backupTopology?.jobProtection === "shared-secret-required"
              ? "Jobs protected"
              : "Preview job protection"}
          </span>
        </div>
      </div>

      {backupTopology ? (
        <div className="table-list">
          {backupTopology.lanes.map((lane) => (
            <article key={lane.provider} className="record-row">
              <div>
                <strong>{lane.provider}</strong>
                <p>{lane.role}</p>
                {lane.bucket ? <p>Bucket: {lane.bucket}</p> : null}
              </div>
              <span className="module-chip">{lane.ready ? "configured" : "not configured"}</span>
            </article>
          ))}
        </div>
      ) : null}

      {backupJobs.length > 0 ? (
        <div className="config-band">
          <div>
            <span className="eyebrow">Backup job ledger</span>
            <h3>Latest worker-recorded attempts</h3>
            <p>
              These are real records from Supabase `backup_jobs`; blocked jobs tell us exactly what
              is missing before we claim production backups.
            </p>
          </div>
          <span className="module-chip">{backupJobs.length} recent jobs</span>
        </div>
      ) : null}

      {backupJobs.length > 0 ? (
        <div className="table-list">
          {backupJobs.slice(0, 5).map((job) => (
            <article key={job.id} className="record-row">
              <div>
                <strong>
                  {job.provider} · {job.job_type}
                </strong>
                <p>{job.error_message ?? "No error recorded."}</p>
                <p>{new Date(job.created_at).toLocaleString()}</p>
              </div>
              <span className="module-chip">{job.status}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
