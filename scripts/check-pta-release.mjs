// Production release contract: prevent accidental public PTA launch without its protections.
// Run as part of DREEM's normal checks, no external services or credentials required.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const app = read("src/App.tsx");
const publicPage = read("src/components/ParentPtaPortal.tsx");
const staff = read("src/components/CommunicationsWorkspace.tsx");
const ptaStaff = read("src/components/PtaStaffWorkspace.tsx");
const standalone = read("src/components/PtaStandalone.tsx");
const edge = read("supabase/functions/pta-public-submit/index.ts");
const migration = read("supabase/migrations/20261026150000_public_pre_pta_parent_voice.sql");
const config = read("supabase/config.toml");
const wf = read(".github/workflows/dreem-pta-supabase-release.yml");

function requires(haystack, needle, description) {
  assert.ok(haystack.includes(needle), description);
}

requires(app, 'publicPtaPath', "Public PTA route must exist");
requires(app, 'ParentPtaPortal', "Public PTA route must use bilingual portal");
requires(app, '/^\\/pta\\/?$/.test(window.location.pathname)', "Standalone PTA home route must exist");
requires(app, '/^\\/pta\\/admin\\/?$/.test(window.location.pathname)', "Standalone management route must exist");
requires(app, '<PtaStandaloneAdmin/>', "PTA management route must load standalone admin");
requires(app, '<PtaStandaloneHome/>', "Standalone home must be publicly accessible");
requires(standalone, '<AuthGate><PtaLeadership /></AuthGate>', "PTA management must require authentication");
requires(standalone, 'canAuthority(workspace.viewer, "institutional_leadership")', "PTA management must require school leadership permission");
assert.ok(!staff.includes('<PtaStaffWorkspace/>'), "PTA management must no longer be embedded in Communications");
requires(ptaStaff, 'Copy parent link', "Staff must be able to copy published consultation link");
requires(ptaStaff, 'Share parent link on WhatsApp', "Staff must be able to distribute parent link on WhatsApp");
requires(ptaStaff, 'setEntries((subs.data??[]) as Entry[])', "Staff data must refresh after status changes");
requires(publicPage, 'name="website"', "Public submission must retain a low-friction bot trap");
requires(publicPage, 'supabase.functions.invoke("pta-public-submit"', "Public form must use protected function");
assert.ok(!publicPage.includes('supabase.rpc("dreem_pta_submit"'), "Public page must never call privileged RPC directly");
requires(publicPage, 'topic==="safety"', "Child safety topics must be blocked from regular PTA workflow");
requires(edge, "if(website)", "Server must reject filled bot-trap submissions");
requires(edge, "contentLength>12_000", "Server must reject oversized public submissions");
requires(edge, 'admin.rpc("dreem_pta_submit_family"', "Server-only family insertion route must exist");
requires(publicPage, "parentName:parentName.trim()", "Public parent form must capture parent name");
requires(publicPage, "childrenNames:childrenNames.trim()", "Public parent form must capture child names");
requires(migration, "revoke all on function public.dreem_pta_submit(uuid,text,text,text,text,text) from public,anon,authenticated", "Old public submission must be blocked");
requires(edge, 'if(!url||!serviceKey)', "Server must fail closed without required Supabase configuration");
requires(migration, "revoke all on function public.dreem_pta_submit(uuid,text,text,text,text,text) from public,anon,authenticated", "Direct anonymous submission permission must be revoked");
requires(migration, "grant execute on function public.dreem_pta_submit(uuid,text,text,text,text,text) to service_role", "Only service role may write submissions");
requires(migration, "alter table public.dreem_pta_submissions enable row level security", "Private submissions must enable RLS");
requires(migration, "revoke all on public.dreem_pta_submissions from anon,authenticated", "Public and regular clients cannot select private case table");
requires(config, "[functions.pta-public-submit]", "Function must have explicit config");
requires(config, "verify_jwt = false", "Public parent intake path must be explicitly configured");
requires(wf, "EXPECTED_REF: vlukkucwtfmfgpzvjyvd", "Release must pin DREEM Supabase project");
requires(wf, "scripts/pta-migration-guard.py", "Migrations must be checked before push");
console.log("DREEM PTA static release contract passed. Live database, secrets and deployment still require independent verification.");
