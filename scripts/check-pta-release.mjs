// Production release contract: prevent accidental public PTA launch without its protections.
// Run as part of DREEM's normal checks, no external services or credentials required.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const app = read("src/App.tsx");
const publicPage = read("src/components/ParentPtaPortal.tsx");
const staff = read("src/components/CommunicationsWorkspace.tsx");
const edge = read("supabase/functions/pta-public-submit/index.ts");
const migration = read("supabase/migrations/20261026150000_public_pre_pta_parent_voice.sql");
const config = read("supabase/config.toml");
const wf = read(".github/workflows/dreem-pta-supabase-release.yml");

function requires(haystack, needle, description) {
  assert.ok(haystack.includes(needle), description);
}

requires(app, 'publicPtaPath', "Public PTA route must exist");
requires(app, 'ParentPtaPortal', "Public PTA route must use bilingual portal");
requires(staff, 'VITE_DREEM_PTA_ENABLED==="true"', "Staff UI must remain protected by release flag");
requires(publicPage, "turnstileToken:captcha", "Public submission must send anti-spam token");
requires(publicPage, 'supabase.functions.invoke("pta-public-submit"', "Public form must use protected function");
assert.ok(!publicPage.includes('supabase.rpc("dreem_pta_submit"'), "Public page must never call privileged RPC directly");
requires(publicPage, 'topic==="safety"', "Child safety topics must be blocked from regular PTA workflow");
requires(edge, "TURNSTILE_SECRET_KEY", "Captcha secret is mandatory server-side");
requires(edge, "siteverify", "Server must verify CAPTCHA with provider");
requires(edge, "outcome.hostname===expectedHost", "CAPTCHA must bind to configured site hostname");
requires(edge, 'admin.rpc("dreem_pta_submit"', "Server-only insertion route must exist");
requires(edge, 'if(!secret||!url||!serviceKey)', "Server must fail closed without required secrets");
requires(migration, "revoke all on function public.dreem_pta_submit(uuid,text,text,text,text,text) from public,anon,authenticated", "Direct anonymous submission permission must be revoked");
requires(migration, "grant execute on function public.dreem_pta_submit(uuid,text,text,text,text,text) to service_role", "Only service role may write submissions");
requires(migration, "alter table public.dreem_pta_submissions enable row level security", "Private submissions must enable RLS");
requires(migration, "revoke all on public.dreem_pta_submissions from anon,authenticated", "Public and regular clients cannot select private case table");
requires(config, "[functions.pta-public-submit]", "Function must have explicit config");
requires(config, "verify_jwt = false", "Captcha-verified anonymous path must be configured");
requires(wf, "EXPECTED_REF: vlukkucwtfmfgpzvjyvd", "Release must pin DREEM Supabase project");
requires(wf, "scripts/pta-migration-guard.py", "Migrations must be checked before push");
console.log("DREEM PTA static release contract passed. Live database, secrets and deployment still require independent verification.");
