export type OfflineOperationStatus = "pending" | "syncing" | "failed" | "tampered";

export interface OfflineOperation<T = unknown> {
  id: string;
  schoolId: string;
  actorId: string;
  role: string;
  deviceId: string;
  entity: string;
  command: string;
  payload: T;
  payloadDigest: string;
  idempotencyKey: string;
  expectedVersion?: string | number;
  correctsOperationId?: string;
  correctionReason?: string;
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

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record=value as Record<string,unknown>;
  return `{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

async function sha256(value:string){
  const bytes=new TextEncoder().encode(value),hash=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(hash)).map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

export async function offlinePayloadDigest(input:{schoolId:string;actorId:string;role:string;entity:string;command:string;payload:unknown;idempotencyKey:string;expectedVersion?:string|number;correctsOperationId?:string;correctionReason?:string}){
  return sha256(canonical(input));
}

export function deviceId() {
  let value = localStorage.getItem(DEVICE);
  if (!value) { value = crypto.randomUUID(); localStorage.setItem(DEVICE, value); }
  return value;
}

export async function enqueueOffline<T>(input: Omit<OfflineOperation<T>, "id"|"deviceId"|"createdAt"|"attempts"|"status"|"payloadDigest">) {
  const semantic={schoolId:input.schoolId,actorId:input.actorId,role:input.role,entity:input.entity,command:input.command,payload:input.payload,idempotencyKey:input.idempotencyKey,expectedVersion:input.expectedVersion,correctsOperationId:input.correctsOperationId,correctionReason:input.correctionReason};
  const operation: OfflineOperation<T> = { ...input, payloadDigest:await offlinePayloadDigest(semantic), id: crypto.randomUUID(), deviceId: deviceId(), createdAt: new Date().toISOString(), attempts: 0, status: "pending" };
  await tx("readwrite", store => store.add(operation));
  window.dispatchEvent(new CustomEvent("dreem:outbox-changed"));
  return operation;
}

export async function enqueueOfflineCorrection<T>(original:OfflineOperation,input:Omit<OfflineOperation<T>,"id"|"deviceId"|"createdAt"|"attempts"|"status"|"payloadDigest"|"correctsOperationId">&{correctionReason:string}){
  if(!input.correctionReason.trim())throw new Error("Explain why this offline record is being corrected.");
  return enqueueOffline({...input,correctsOperationId:original.id,correctionReason:input.correctionReason.trim()});
}

export async function listOffline(scope?: { schoolId?: string; actorId?: string }) {
  const rows = await tx<OfflineOperation[]>("readonly", store => store.getAll());
  return rows.filter(item => (!scope?.schoolId || item.schoolId === scope.schoolId) && (!scope?.actorId || item.actorId === scope.actorId)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}

export async function pendingOfflineCount(scope?: { schoolId?: string; actorId?: string }) {
  return (await listOffline(scope)).filter(item=>item.status!=="tampered").length;
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

async function integrityValid(operation:OfflineOperation){
  const semantic={schoolId:operation.schoolId,actorId:operation.actorId,role:operation.role,entity:operation.entity,command:operation.command,payload:operation.payload,idempotencyKey:operation.idempotencyKey,expectedVersion:operation.expectedVersion,correctsOperationId:operation.correctsOperationId,correctionReason:operation.correctionReason};
  return operation.payloadDigest===await offlinePayloadDigest(semantic);
}

export async function replayOffline(scope: { schoolId: string; actorId: string }, handlers: Record<string,(payload: unknown, operation: OfflineOperation)=>Promise<unknown>>) {
  if (!navigator.onLine) return { synced: 0, failed: 0, tampered:0 };
  const rows = await listOffline(scope); let synced=0, failed=0, tampered=0;
  for (const operation of rows) {
    if(!(await integrityValid(operation))){operation.status="tampered";operation.lastError="Offline operation integrity check failed. The server action was not attempted.";await save(operation);tampered++;continue;}
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
  return { synced, failed, tampered };
}
