import { useEffect, useState } from "react";
import { env } from "../../lib/env";
import { storageConnections as starterStorageConnections } from "../../shared/data";
import type {
  BackupJobRecord,
  StorageConnection,
  UserProfile,
  WorkerBackupTopology
} from "../../shared/types";
import { loadStorageConnections } from "./repositories/storageRepository";

export function useStorageConnections(activeUser: UserProfile | null) {
  const [storageConnections, setStorageConnections] =
    useState<StorageConnection[]>(starterStorageConnections);
  const [backupTopology, setBackupTopology] = useState<WorkerBackupTopology | null>(null);
  const [backupJobs, setBackupJobs] = useState<BackupJobRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError("");

      try {
        const connections = await loadStorageConnections(activeUser);
        if (active) {
          setStorageConnections(connections);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load storage connections."
          );
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [activeUser]);

  useEffect(() => {
    let active = true;

    async function loadWorkerBackupState() {
      if (!env.workerUrl) {
        setBackupTopology(null);
        setBackupJobs([]);
        return;
      }

      try {
        const workerBaseUrl = env.workerUrl.replace(/\/$/, "");
        const [topologyResponse] = await Promise.all([
          fetch(`${workerBaseUrl}/backup/topology`, {
            headers: {
              Accept: "application/json"
            }
          })
        ]);

        if (!topologyResponse.ok) {
          throw new Error(`Worker topology responded with ${topologyResponse.status}.`);
        }

        const topology = (await topologyResponse.json()) as WorkerBackupTopology;
        if (active) {
          setBackupTopology(topology);
          // Job history is server-secret protected; the admin job console will
          // load it through an authenticated backend action when enabled.
          setBackupJobs([]);
        }
      } catch {
        if (active) {
          setBackupTopology(null);
          setBackupJobs([]);
        }
      }
    }

    void loadWorkerBackupState();

    return () => {
      active = false;
    };
  }, []);

  return {
    storageConnections,
    backupTopology,
    backupJobs,
    error
  };
}
