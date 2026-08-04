import { env } from "../../../lib/env";
import { supabase } from "../../../lib/supabase";
import { storageConnections as starterStorageConnections } from "../../../shared/data";
import type { StorageConnection, StorageProvider, UserProfile } from "../../../shared/types";

type StorageConnectionRow = {
  provider: StorageProvider;
  label: string;
  status: "active" | "planned" | "disabled";
};

const purposeByProvider: Record<StorageProvider, string> = starterStorageConnections.reduce(
  (accumulator, connection) => {
    accumulator[connection.provider] = connection.purpose;
    return accumulator;
  },
  {} as Record<StorageProvider, string>
);

export async function loadStorageConnections(activeUser: UserProfile | null) {
  if (!activeUser?.schoolId || env.demoMode || !supabase) {
    return starterStorageConnections;
  }

  const { data, error } = await supabase
    .from("storage_connections")
    .select("provider,label,status")
    .eq("school_id", activeUser.schoolId)
    .order("provider");

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as StorageConnectionRow[];
  if (rows.length === 0) {
    return starterStorageConnections;
  }

  return rows
    .filter((row) => row.status !== "disabled")
    .map<StorageConnection>((row) => ({
      provider: row.provider,
      label: row.label,
      status: row.status === "active" ? "active" : "planned",
      purpose: purposeByProvider[row.provider]
    }));
}
