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
  return viewer.authorityScopes?.length ? viewer.authorityScopes : legacyAuthorityScopes(viewer.role);
}

export function canAuthority(viewer:AccessViewer,scope:AuthorityScope){
  return scopesFor(viewer).includes(scope);
}

export function canOpenView(viewer:AccessViewer,view:WorkspaceView):boolean{
  const scopes=scopesFor(viewer);
  const has=(...wanted:AuthorityScope[])=>wanted.some(scope=>scopes.includes(scope));
  const role=viewer.role;

  switch(view){
    case "command":
      return has("institutional_leadership","audit","academics","transport","finance_approval")
        || ["teacher","accountant","transport_manager"].includes(role);
    case "admissions": return has("admissions");
    case "operations": return has("staff_management","admissions","academics")
      || role==="teacher";
    case "academics": return has("academics") && !["parent","student"].includes(role);
    case "learning": return has("academics") || ["parent","student","teacher","tutor"].includes(role);
    case "learners":
      return has("institutional_leadership","academics","admissions","finance_collection","finance_approval","safeguarding","transport","gate","audit")
        || ["parent","student","teacher","tutor"].includes(role);
    case "credentials": return has("admissions","gate","school_configuration");
    case "teachers": return has("academics","staff_management","institutional_leadership");
    case "care": return has("safeguarding","institutional_leadership") || ["teacher","tutor"].includes(role);
    case "transport": return has("transport","gate","institutional_leadership") || ["parent","student"].includes(role);
    case "finance": return has("finance_collection","finance_approval","audit","institutional_leadership");
    case "signals": return has("communications","institutional_leadership") || ["parent","student","teacher","tutor","transport_manager"].includes(role);
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
