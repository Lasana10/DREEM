import http from "node:http";
import crypto from "node:crypto";

const port = Number(process.env.PORT ?? 10000);
const maxBodyBytes = 2 * 1024 * 1024;

const requiredServerEnv = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY"
];

const optionalIntegrationEnv = {
  oneDrive: [
    "ONEDRIVE_CLIENT_ID",
    "ONEDRIVE_CLIENT_SECRET",
    "ONEDRIVE_TENANT_ID",
    "ONEDRIVE_REDIRECT_URI"
  ],
  cloudflareR2: [
    "CLOUDFLARE_R2_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_DREEM_BUCKET"
  ],
  backblazeB2: [
    "B2_APPLICATION_KEY_ID",
    "B2_APPLICATION_KEY",
    "B2_DREEM_BUCKET_NAME",
    "B2_S3_ENDPOINT"
  ],
  smtp: [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM"
  ]
};

const backupTables = [
  "schools",
  "profiles",
  "dreem_school_memberships",
  "access_identities",
  "students",
  "attendance",
  "fee_accounts",
  "fee_payments",
  "fee_reminders",
  "classroom_materials",
  "assignment_submissions",
  "announcements",
  "transport_routes",
  "storage_connections",
  "school_settings",
  "school_classes",
  "school_subjects",
  "fee_categories",
  "workflow_corrections",
  "bursar_liabilities",
  "bursar_settlements",
  "audit_events",
  "sync_queue"
];

function json(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.DREEM_WEB_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-DREEM-WORKER-SECRET",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body, null, 2));
}

async function readJsonBody(request) {
  const chunks = [];
  let receivedBytes = 0;

  for await (const chunk of request) {
    receivedBytes += chunk.length;
    if (receivedBytes > maxBodyBytes) {
      throw new Error("Request body exceeds the 2 MB limit.");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function supabaseRestHeaders(prefer) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {})
  };
}

async function supabaseRequest(path, options = {}) {
  if (!integrationReady(requiredServerEnv)) {
    return { ok: false, error: "Supabase worker credentials are not configured." };
  }

  const response = await fetch(
    `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        ...supabaseRestHeaders(options.prefer),
        ...(options.headers ?? {})
      }
    }
  );

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: body?.message ?? body?.hint ?? text ?? "Supabase request failed."
    };
  }

  return { ok: true, body };
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key, value, encoding) {
  return crypto.createHmac("sha256", key).update(value).digest(encoding);
}

function encodeS3PathPart(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function getS3Config(provider) {
  if (provider === "cloudflare-r2") {
    const endpoint =
      process.env.CLOUDFLARE_R2_ENDPOINT ??
      `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    return {
      endpoint,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      bucket: process.env.CLOUDFLARE_R2_DREEM_BUCKET,
      region: process.env.CLOUDFLARE_R2_REGION ?? "auto"
    };
  }

  if (provider === "backblaze-b2") {
    return {
      endpoint: process.env.B2_S3_ENDPOINT,
      accessKeyId: process.env.B2_APPLICATION_KEY_ID,
      secretAccessKey: process.env.B2_APPLICATION_KEY,
      bucket: process.env.B2_DREEM_BUCKET_NAME,
      region: process.env.B2_REGION ?? "us-west-004"
    };
  }

  return null;
}

async function signedS3PutObject(provider, key, content, contentType) {
  const config = getS3Config(provider);

  if (!config?.endpoint || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
    return { ok: false, error: `${provider} S3-compatible credentials are not configured.` };
  }

  const endpoint = config.endpoint.replace(/\/$/, "");
  const bucket = encodeS3PathPart(config.bucket);
  const encodedKey = key.split("/").map(encodeS3PathPart).join("/");
  const url = new URL(`${endpoint}/${bucket}/${encodedKey}`);
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = `${dateStamp}T${now.toISOString().slice(11, 19).replace(/:/g, "")}Z`;
  const payloadHash = sha256Hex(content);
  const host = url.host;
  const canonicalUri = url.pathname;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join("\n");
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"),
    "aws4_request"
  );
  const signature = hmac(signingKey, stringToSign, "hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const uploadResponse = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: authorization,
      "Content-Type": contentType,
      "X-Amz-Content-Sha256": payloadHash,
      "X-Amz-Date": amzDate
    },
    body: content
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    return {
      ok: false,
      status: uploadResponse.status,
      error: errorText || `${provider} upload failed.`
    };
  }

  return {
    ok: true,
    key,
    bucket: config.bucket,
    bytes: Buffer.byteLength(content)
  };
}

async function signedS3HeadObject(provider, key) {
  const config = getS3Config(provider);

  if (!config?.endpoint || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
    return { ok: false, error: `${provider} S3-compatible credentials are not configured.` };
  }

  const endpoint = config.endpoint.replace(/\/$/, "");
  const bucket = encodeS3PathPart(config.bucket);
  const encodedKey = key.split("/").map(encodeS3PathPart).join("/");
  const url = new URL(`${endpoint}/${bucket}/${encodedKey}`);
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = `${dateStamp}T${now.toISOString().slice(11, 19).replace(/:/g, "")}Z`;
  const payloadHash = sha256Hex("");
  const host = url.host;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ].join("\n");
  const canonicalRequest = [
    "HEAD",
    url.pathname,
    "",
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), config.region), "s3"),
    "aws4_request"
  );
  const signature = hmac(signingKey, stringToSign, "hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const headResponse = await fetch(url, {
    method: "HEAD",
    headers: {
      Authorization: authorization,
      "X-Amz-Content-Sha256": payloadHash,
      "X-Amz-Date": amzDate
    }
  });

  if (!headResponse.ok) {
    return {
      ok: false,
      status: headResponse.status,
      error: `${provider} restore-test HEAD failed for ${key}.`
    };
  }

  return {
    ok: true,
    bucket: config.bucket,
    key,
    bytes: Number(headResponse.headers.get("content-length") ?? 0),
    etag: headResponse.headers.get("etag")
  };
}

function envStatus(keys) {
  return keys.map((key) => ({
    key,
    configured: Boolean(process.env[key])
  }));
}

function integrationReady(keys) {
  return keys.every((key) => Boolean(process.env[key]));
}

function jobSecretConfigured() {
  return Boolean(process.env.DREEM_WORKER_JOB_SECRET);
}

function isAuthorizedJobRequest(request) {
  const configuredSecret = process.env.DREEM_WORKER_JOB_SECRET;
  if (!configuredSecret) {
    return true;
  }

  return request.headers["x-dreem-worker-secret"] === configuredSecret;
}

function getBackupTopology() {
  const oneDriveReady = integrationReady(optionalIntegrationEnv.oneDrive);
  const r2Ready = integrationReady(optionalIntegrationEnv.cloudflareR2);
  const b2Ready = integrationReady(optionalIntegrationEnv.backblazeB2);

  return {
    policy: "supabase-primary-r2-fast-replica-b2-cold-replica-onedrive-school-owned-copy",
    ready: r2Ready || b2Ready || oneDriveReady,
    jobProtection: jobSecretConfigured() ? "shared-secret-required" : "open-internal-preview",
    lanes: [
      {
        provider: "supabase",
        role: "app-native files, database records, and realtime school operations",
        ready: integrationReady(requiredServerEnv)
      },
      {
        provider: "cloudflare-r2",
        role: "fast object backup, public/static asset mirror, and school document replica",
        ready: r2Ready,
        bucket: process.env.CLOUDFLARE_R2_DREEM_BUCKET ?? null
      },
      {
        provider: "backblaze-b2",
        role: "independent cold backup so R2/Supabase failures do not become a single point of failure",
        ready: b2Ready,
        bucket: process.env.B2_DREEM_BUCKET_NAME ?? null
      },
      {
        provider: "onedrive",
        role: "school-owned administrative copy and human-readable document backup",
        ready: oneDriveReady
      },
      {
        provider: "local-node",
        role: "future Raspberry Pi or school-machine cache for offline resilience",
        ready: false
      }
    ]
  };
}

function buildBackupManifest({ provider, job, ready, body }) {
  return {
    provider,
    job,
    requestedAt: new Date().toISOString(),
    schoolId: body.schoolId ?? null,
    scope: body.scope ?? "school",
    transferAdapter: "provider-readiness-check",
    credentialsPresent: ready,
    policy: getBackupTopology().policy,
    note: "School-scoped operational backup manifest. Secrets remain server-side."
  };
}

function getRuntimeStatus() {
  const oneDriveReady = integrationReady(optionalIntegrationEnv.oneDrive);
  const r2Ready = integrationReady(optionalIntegrationEnv.cloudflareR2);
  const b2Ready = integrationReady(optionalIntegrationEnv.backblazeB2);
  const smtpReady = integrationReady(optionalIntegrationEnv.smtp);
  const serverReady = integrationReady(requiredServerEnv);

  return {
    service: "dreem-worker",
    role: "backend-sync-and-integration-lane",
    status: serverReady ? "ready" : "missing-required-env",
    render: {
      detected: process.env.RENDER === "true",
      serviceName: process.env.RENDER_SERVICE_NAME ?? null,
      serviceType: process.env.RENDER_SERVICE_TYPE ?? null,
      externalUrl: process.env.RENDER_EXTERNAL_URL ?? null,
      gitCommit: process.env.RENDER_GIT_COMMIT ?? null
    },
    required: envStatus(requiredServerEnv),
    integrations: {
      oneDrive: {
        ready: oneDriveReady,
        env: envStatus(optionalIntegrationEnv.oneDrive),
        nextUse: "school-owned file backup and document sync"
      },
      cloudflareR2: {
        ready: r2Ready,
        env: envStatus(optionalIntegrationEnv.cloudflareR2),
        nextUse: "fast S3-compatible backup and object mirror for DREEM-owned buckets"
      },
      backblazeB2: {
        ready: b2Ready,
        env: envStatus(optionalIntegrationEnv.backblazeB2),
        nextUse: "independent cold backup outside Supabase and Cloudflare"
      },
      smtp: {
        ready: smtpReady,
        env: envStatus(optionalIntegrationEnv.smtp),
        nextUse: "transactional email for OTP support, invites, receipts, and alerts"
      }
    },
    backupTopology: getBackupTopology()
  };
}

async function createBackupJobLog({ provider, jobType, status, manifest, errorMessage, body }) {
  const now = new Date().toISOString();
  const insertResult = await supabaseRequest("backup_jobs", {
    method: "POST",
    prefer: "return=representation",
    body: JSON.stringify({
      school_id: body.schoolId ?? null,
      provider,
      job_type: jobType,
      status,
      source: "render-worker",
      object_count: 0,
      bytes_processed: 0,
      manifest,
      error_message: errorMessage ?? null,
      requested_by: body.requestedBy ?? "worker",
      started_at: now,
      finished_at: now,
      updated_at: now
    })
  });

  if (!insertResult.ok) {
    return { ok: false, error: insertResult.error };
  }

  return { ok: true, job: insertResult.body?.[0] ?? null };
}

async function updateBackupJobLog(jobId, fields) {
  const result = await supabaseRequest(`backup_jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    prefer: "return=representation",
    body: JSON.stringify({
      ...fields,
      updated_at: new Date().toISOString()
    })
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, job: result.body?.[0] ?? null };
}

async function exportSchoolSnapshot(schoolId) {
  const tables = {};
  const errors = [];
  let objectCount = 0;

  for (const table of backupTables) {
    const filter =
      table === "schools"
        ? `id=eq.${encodeURIComponent(schoolId)}`
        : `school_id=eq.${encodeURIComponent(schoolId)}`;
    const result = await supabaseRequest(
      `${table}?select=*&${filter}&limit=10000`
    );

    if (!result.ok) {
      errors.push({ table, error: result.error });
      tables[table] = [];
      continue;
    }

    const rows = Array.isArray(result.body) ? result.body : [];
    tables[table] = rows;
    objectCount += rows.length;
  }

  return { tables, errors, objectCount };
}

async function executeS3Backup({ request, response, job, provider, requiredKeys, messageWhenReady }) {
  const ready = integrationReady(requiredKeys);

  if (request.method === "GET") {
    json(response, ready ? 200 : 501, {
      job,
      ready,
      accepted: false,
      method: "POST",
      protected: jobSecretConfigured(),
      message: ready ? messageWhenReady : `${job} credentials are not configured yet.`
    });
    return;
  }

  if (!isAuthorizedJobRequest(request)) {
    json(response, 401, { error: "Missing or invalid DREEM worker job secret." });
    return;
  }

  const body = await readJsonBody(request);

  if (!body.schoolId) {
    const logResult = await createBackupJobLog({
      provider,
      jobType: "backup",
      status: "blocked",
      manifest: buildBackupManifest({ provider, job, ready, body }),
      errorMessage: "schoolId is required for a scoped DREEM backup.",
      body
    });

    json(response, 400, {
      job,
      accepted: false,
      logged: logResult.ok,
      backupJob: logResult.ok ? logResult.job : null,
      error: "schoolId is required."
    });
    return;
  }

  const queuedManifest = {
    ...buildBackupManifest({ provider, job, ready, body }),
    transferAdapter: "s3-compatible-json-snapshot"
  };
  const logResult = await createBackupJobLog({
    provider,
    jobType: "backup",
    status: ready ? "running" : "blocked",
    manifest: queuedManifest,
    errorMessage: ready ? null : `${job} credentials are not configured yet.`,
    body
  });

  if (!logResult.ok) {
    json(response, 503, {
      job,
      accepted: false,
      error: logResult.error
    });
    return;
  }

  if (!ready) {
    json(response, 501, {
      job,
      accepted: false,
      backupJob: logResult.job,
      blocker: `${job} credentials are not configured yet.`
    });
    return;
  }

  const startedAt = new Date().toISOString();
  const snapshot = await exportSchoolSnapshot(body.schoolId);
  const createdAt = new Date().toISOString();
  const objectKey = [
    "schools",
    body.schoolId,
    "snapshots",
    `${createdAt.replace(/[:.]/g, "-")}-${provider}.json`
  ].join("/");
  const payload = JSON.stringify(
    {
      manifest: {
        ...queuedManifest,
        transferAdapter: "s3-compatible-json-snapshot",
        objectKey,
        startedAt,
        createdAt,
        tables: backupTables,
        warnings: snapshot.errors
      },
      data: snapshot.tables
    },
    null,
    2
  );
  const uploadResult = await signedS3PutObject(provider, objectKey, payload, "application/json");
  const finalStatus = uploadResult.ok && snapshot.errors.length === 0 ? "completed" : "failed";
  const finalError = uploadResult.ok
    ? snapshot.errors.length > 0
      ? `Snapshot completed with ${snapshot.errors.length} table export warning(s).`
      : null
    : uploadResult.error;
  const finalManifest = {
    ...queuedManifest,
    transferAdapter: "s3-compatible-json-snapshot",
    objectKey,
    bucket: uploadResult.ok ? uploadResult.bucket : null,
    bytes: uploadResult.ok ? uploadResult.bytes : 0,
    exportedTables: backupTables.length,
    exportWarnings: snapshot.errors
  };
  const updateResult = await updateBackupJobLog(logResult.job.id, {
    status: finalStatus,
    object_count: snapshot.objectCount,
    bytes_processed: uploadResult.ok ? uploadResult.bytes : 0,
    manifest: finalManifest,
    error_message: finalError,
    finished_at: new Date().toISOString()
  });

  json(response, uploadResult.ok ? 202 : 502, {
    job,
    accepted: uploadResult.ok,
    backupJob: updateResult.ok ? updateResult.job : logResult.job,
    objectKey,
    exportedRows: snapshot.objectCount,
    warnings: snapshot.errors,
    error: uploadResult.ok ? undefined : uploadResult.error
  });
}

async function executeS3RestoreTest({ request, response, job, provider, requiredKeys }) {
  const ready = integrationReady(requiredKeys);

  if (request.method === "GET") {
    json(response, ready ? 200 : 501, {
      job,
      ready,
      accepted: false,
      method: "POST",
      protected: jobSecretConfigured(),
      body: {
        schoolId: "required",
        objectKey: "required"
      }
    });
    return;
  }

  if (!isAuthorizedJobRequest(request)) {
    json(response, 401, { error: "Missing or invalid DREEM worker job secret." });
    return;
  }

  const body = await readJsonBody(request);
  const manifest = {
    ...buildBackupManifest({ provider, job, ready, body }),
    transferAdapter: "s3-compatible-head-restore-test",
    objectKey: body.objectKey ?? null
  };

  if (!body.schoolId || !body.objectKey) {
    const logResult = await createBackupJobLog({
      provider,
      jobType: "restore-test",
      status: "blocked",
      manifest,
      errorMessage: "schoolId and objectKey are required for restore testing.",
      body
    });

    json(response, 400, {
      job,
      accepted: false,
      logged: logResult.ok,
      backupJob: logResult.ok ? logResult.job : null,
      error: "schoolId and objectKey are required."
    });
    return;
  }

  const logResult = await createBackupJobLog({
    provider,
    jobType: "restore-test",
    status: ready ? "running" : "blocked",
    manifest,
    errorMessage: ready ? null : `${job} credentials are not configured yet.`,
    body
  });

  if (!logResult.ok) {
    json(response, 503, { job, accepted: false, error: logResult.error });
    return;
  }

  if (!ready) {
    json(response, 501, {
      job,
      accepted: false,
      backupJob: logResult.job,
      blocker: `${job} credentials are not configured yet.`
    });
    return;
  }

  const headResult = await signedS3HeadObject(provider, body.objectKey);
  const updateResult = await updateBackupJobLog(logResult.job.id, {
    status: headResult.ok ? "completed" : "failed",
    object_count: headResult.ok ? 1 : 0,
    bytes_processed: headResult.ok ? headResult.bytes : 0,
    manifest: {
      ...manifest,
      bucket: headResult.ok ? headResult.bucket : null,
      bytes: headResult.ok ? headResult.bytes : 0,
      etag: headResult.ok ? headResult.etag : null
    },
    error_message: headResult.ok ? null : headResult.error,
    finished_at: new Date().toISOString()
  });

  json(response, headResult.ok ? 200 : 502, {
    job,
    accepted: headResult.ok,
    backupJob: updateResult.ok ? updateResult.job : logResult.job,
    objectKey: body.objectKey,
    error: headResult.ok ? undefined : headResult.error
  });
}

async function listBackupJobs(request, response, url) {
  if (!isAuthorizedJobRequest(request)) {
    json(response, 401, { error: "Backup job history requires the worker job secret." });
    return;
  }

  const schoolId = url.searchParams.get("schoolId");
  if (!schoolId) {
    json(response, 400, { error: "schoolId is required." });
    return;
  }

  const result = await supabaseRequest(
    `backup_jobs?select=id,school_id,provider,job_type,status,error_message,requested_by,created_at,finished_at,manifest&school_id=eq.${encodeURIComponent(schoolId)}&order=created_at.desc&limit=20`
  );

  if (!result.ok) {
    json(response, 503, { error: result.error });
    return;
  }

  json(response, 200, { jobs: result.body ?? [] });
}

async function jobResponse(request, response, job, provider, jobType, requiredKeys, messageWhenReady) {
  const ready = integrationReady(requiredKeys);

  if (request.method === "GET") {
    json(response, ready ? 200 : 501, {
      job,
      ready,
      accepted: false,
      method: "POST",
      protected: jobSecretConfigured(),
      message: ready ? messageWhenReady : `${job} credentials are not configured yet.`
    });
    return;
  }

  if (request.method !== "POST") {
    json(response, 405, { error: "Method not allowed" });
    return;
  }

  if (!isAuthorizedJobRequest(request)) {
    json(response, 401, { error: "Missing or invalid DREEM worker job secret." });
    return;
  }

  const body = await readJsonBody(request);
  const manifest = buildBackupManifest({ provider, job, ready, body });
  const errorMessage = ready
    ? `${job} credentials are configured, but the object transfer adapter is not implemented yet.`
    : `${job} credentials are not configured yet.`;
  const logResult = await createBackupJobLog({
    provider,
    jobType,
    status: "blocked",
    manifest,
    errorMessage,
    body
  });

  json(response, 501, {
    job,
    accepted: false,
    ready,
    logged: logResult.ok,
    backupJob: logResult.ok ? logResult.job : null,
    message: ready ? messageWhenReady : `${job} credentials are not configured yet.`,
    blocker: errorMessage,
    logError: logResult.ok ? undefined : logResult.error
  });
}

async function handleRequest(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": process.env.DREEM_WEB_ORIGIN ?? "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-DREEM-WORKER-SECRET",
      "Access-Control-Max-Age": "600"
    });
    response.end();
    return;
  }

  if (request.method !== "GET" && request.method !== "POST") {
    json(response, 405, { error: "Method not allowed" });
    return;
  }

  if (url.pathname === "/" || url.pathname === "/health") {
    const status = getRuntimeStatus();
    json(response, status.status === "ready" ? 200 : 503, status);
    return;
  }

  if (url.pathname === "/integrations/status") {
    json(response, 200, getRuntimeStatus().integrations);
    return;
  }

  if (url.pathname === "/backup/topology") {
    json(response, 200, getBackupTopology());
    return;
  }

  if (url.pathname === "/backup/jobs") {
    await listBackupJobs(request, response, url);
    return;
  }

  if (url.pathname === "/jobs/onedrive-sync") {
    await jobResponse(
      request,
      response,
      "onedrive-sync",
      "onedrive",
      "sync",
      optionalIntegrationEnv.oneDrive,
      "OneDrive sync worker is configured for school-owned document backup."
    );
    return;
  }

  if (url.pathname === "/jobs/r2-backup") {
    await executeS3Backup({
      request,
      response,
      job: "r2-backup",
      provider: "cloudflare-r2",
      requiredKeys: optionalIntegrationEnv.cloudflareR2,
      messageWhenReady: "Cloudflare R2 backup worker is configured for DREEM object replication."
    });
    return;
  }

  if (url.pathname === "/jobs/b2-backup") {
    await executeS3Backup({
      request,
      response,
      job: "b2-backup",
      provider: "backblaze-b2",
      requiredKeys: optionalIntegrationEnv.backblazeB2,
      messageWhenReady: "Backblaze B2 backup worker is configured for independent cold storage."
    });
    return;
  }

  if (url.pathname === "/jobs/r2-restore-test") {
    await executeS3RestoreTest({
      request,
      response,
      job: "r2-restore-test",
      provider: "cloudflare-r2",
      requiredKeys: optionalIntegrationEnv.cloudflareR2
    });
    return;
  }

  if (url.pathname === "/jobs/b2-restore-test") {
    await executeS3RestoreTest({
      request,
      response,
      job: "b2-restore-test",
      provider: "backblaze-b2",
      requiredKeys: optionalIntegrationEnv.backblazeB2
    });
    return;
  }

  if (url.pathname === "/jobs/email-dispatch") {
    const smtpReady = integrationReady(optionalIntegrationEnv.smtp);
    json(response, smtpReady ? 202 : 501, {
      job: "email-dispatch",
      accepted: smtpReady,
      message: smtpReady
        ? "SMTP dispatch is configured; notification queue can be enabled next."
        : "SMTP credentials are not configured yet."
    });
    return;
  }

  json(response, 404, { error: "Not found" });
}

http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    json(response, 500, {
      error: error instanceof Error ? error.message : "Worker request failed"
    });
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`DREEM worker listening on ${port}`);
});
