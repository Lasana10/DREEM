import type { Role } from "../domain/types";
import type { AuthorityScope } from "./authority";
import { legacyAuthorityScopes } from "./authority";

export type WorkspaceView =
  | "command" | "admissions" | "operations" | "academics" | "learning"
  | "learners" | "credentials" | "teachers" | "care" | "transport"
  | "finance" | "signals" | "studio";

export type AccessViewer = {
  role: Role;
  authorityScopes?: AuthorityScope[];
  positionTitle?: string;
};

function scopesFor(viewer:AccessViewer):AuthorityScope[] {
  // Once authority has been resolved, an explicit empty list means no delegated
  // authority. Only legacy viewers with no authority payload at all may fall back.
  return viewer.authorityScopes !== undefined ? viewer.authorityScopes : legacyAuthorityScopes(viewer.role);
}

export function canAuthority(viewer:AccessViewer,scope:AuthorityScope){
  return scopesFor(viewer).includes(scope);
}

export function canAnyAuthority(viewer:AccessViewer,...scopes:AuthorityScope[]){
  const owned=scopesFor(viewer);return scopes.some(scope=>owned.includes(scope));
}

export function canOpenView(viewer:AccessViewer,view:WorkspaceView):boolean{
  const has=(...wanted:AuthorityScope[])=>canAnyAuthority(viewer,...wanted);
  const role=viewer.role;
  switch(view){
    case "command":
      return has("institutional_leadership","audit","academics_approval","admissions_decision","transport_management","finance_approval")
        || (role==="teacher" && viewer.authorityScopes===undefined);
    case "admissions": return has("admissions_intake","admissions_decision");
    case "operations": return has("staff_management","admissions_intake","academics_delivery") || (role==="teacher" && viewer.authorityScopes===undefined);
    case "academics": return has("academics_delivery","academics_approval");
    case "learning": return has("academics_delivery","academics_approval") || ["parent","student"].includes(role);
    case "learners":
      return has("institutional_leadership","academics_delivery","academics_approval","admissions_intake","admissions_decision","finance_collection","finance_approval","safeguarding","transport_management","gate","audit")
        || ["parent","student"].includes(role);
    case "credentials": return has("admissions_intake","admissions_decision","school_configuration");
    case "teachers": return has("academics_approval","staff_management","institutional_leadership");
    case "care": return has("safeguarding","institutional_leadership") || has("academics_delivery");
    case "transport": return has("transport_management","transport_operation","gate","institutional_leadership") || ["parent","student"].includes(role);
    case "finance": return has("finance_collection","finance_approval","audit","institutional_leadership");
    case "signals": return has("communications_publish","communications_approve","institutional_leadership") || ["parent","student"].includes(role) || (viewer.authorityScopes===undefined && ["teacher","tutor"].includes(role));
    case "studio": return has("school_configuration");
  }
}

const preferred:Partial<Record<Role,WorkspaceView[]>>={
  platform_founder:["command"], school_owner:["command"], principal:["command"], administrator:["command","admissions"],
  academic_head:["command","academics"], bursar:["finance"], accountant:["finance","command"],
  teacher:["command","operations"], tutor:["learning"], transport_manager:["transport","command"],
  driver:["transport"], security_guard:["transport"], parent:["learning"], student:["learning"], auditor:["command","finance"],
};

export function defaultWorkspaceView(viewer:AccessViewer):WorkspaceView{
  const candidates=[
    ...(preferred[viewer.role]??[]),
    "command","admissions","operations","academics","learning","learners","transport","finance","signals","studio",
  ] as WorkspaceView[];
  return candidates.find(view=>canOpenView(viewer,view))??"command";
}

export function allowedWorkspaceViews(viewer:AccessViewer):WorkspaceView[]{
  const views:WorkspaceView[]=["command","admissions","operations","academics","learning","learners","credentials","teachers","care","transport","finance","signals","studio"];
  return views.filter(view=>canOpenView(viewer,view));
}
