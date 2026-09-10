export type OfflineOperationStatus = "pending" | "syncing" | "failed";

export interface OfflineOperation<T = unknown> {
  id: string;
  schoolId: string;
  actorId: string;
  role: string;
  deviceId: string;
  entity: string;
  command: string;
  payload: T;
  idempotencyKey: string;
  expectedVersion?: string | number;
  createdAt: string;
  attempts: number;
  nextAttemptAt?: string;
  lastError?: string;
  status: OfflineOperationStatus;
}

const DB = "dreem-offline-v1";
const STORE = "operations";
const DEVICE = "dreem-device-id";
const MAX_ATTEMPTS = 8;

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline store could not be opened."));
  });
}

async function tx<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline transaction failed."));
  });
}

export function deviceId() {
  let value = localStorage.getItem(DEVICE);
  if (!value) { value = crypto.randomUUID(); localStorage.setItem(DEVICE, value); }
  return value;
}

export async function enqueueOffline<T>(input: Omit<OfflineOperation<T>, "id"|"deviceId"|"createdAt"|"attempts"|"status">) {
  const operation: OfflineOperation<T> = { ...input, id: crypto.randomUUID(), deviceId: deviceId(), createdAt: new Date().toISOString(), attempts: 0, status: "pending" };
  await tx("readwrite", store => store.add(operation));
  window.dispatchEvent(new CustomEvent("dreem:outbox-changed"));
  return operation;
}

export async function listOffline(scope?: { schoolId?: string; actorId?: string }) {
  const rows = await tx<OfflineOperation[]>("readonly", store => store.getAll());
  return rows.filter(item => (!scope?.schoolId || item.schoolId === scope.schoolId) && (!scope?.actorId || item.actorId === scope.actorId)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}

export async function pendingOfflineCount(scope?: { schoolId?: string; actorId?: string }) {
  return (await listOffline(scope)).length;
}

export async function clearOfflineForActor(actorId: string) {
  const rows = await listOffline({ actorId });
  const database = await db();
  await new Promise<void>((resolve,reject)=>{
    const transaction=database.transaction(STORE,"readwrite"), store=transaction.objectStore(STORE);
    rows.forEach(row=>store.delete(row.id));
    transaction.oncomplete=()=>{database.close();resolve();}; transaction.onerror=()=>reject(transaction.error);
  });
  window.dispatchEvent(new CustomEvent("dreem:outbox-changed"));
}

async function save(operation: OfflineOperation) { await tx("readwrite", store => store.put(operation)); }
async function remove(id: string) { await tx("readwrite", store => store.delete(id)); }

export async function replayOffline(scope: { schoolId: string; actorId: string }, handlers: Record<string,(payload: unknown, operation: OfflineOperation)=>Promise<unknown>>) {
  if (!navigator.onLine) return { synced: 0, failed: 0 };
  const rows = await listOffline(scope); let synced=0, failed=0;
  for (const operation of rows) {
    const due = !operation.nextAttemptAt || Date.parse(operation.nextAttemptAt) <= Date.now();
    if (!due || operation.attempts >= MAX_ATTEMPTS) { failed++; continue; }
    const handler = handlers[operation.command];
    if (!handler) { failed++; continue; }
    operation.status="syncing"; await save(operation);
    try { await handler(operation.payload, operation); await remove(operation.id); synced++; }
    catch (reason) {
      operation.attempts += 1; operation.status="failed"; operation.lastError=reason instanceof Error?reason.message:"Sync failed";
      const delay=Math.min(60_000, 1_000 * 2 ** operation.attempts);
      operation.nextAttemptAt=new Date(Date.now()+delay).toISOString(); await save(operation); failed++;
    }
  }
  window.dispatchEvent(new CustomEvent("dreem:outbox-changed"));
  return { synced, failed };
}
