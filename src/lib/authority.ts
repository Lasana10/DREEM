import type { Role } from "../domain/types";

export type AuthorityScope =
  | "institutional_leadership"
  | "academics"
  | "admissions"
  | "finance_collection"
  | "finance_approval"
  | "safeguarding"
  | "transport"
  | "gate"
  | "staff_management"
  | "communications"
  | "audit"
  | "school_configuration";

const legacy: Partial<Record<Role, AuthorityScope[]>> = {
  platform_founder:["institutional_leadership","academics","admissions","finance_collection","finance_approval","safeguarding","transport","gate","staff_management","communications","audit","school_configuration"],
  school_owner:["institutional_leadership","academics","admissions","finance_approval","safeguarding","transport","staff_management","communications","audit","school_configuration"],
  principal:["institutional_leadership","academics","admissions","finance_approval","safeguarding","transport","staff_management","communications","school_configuration"],
  administrator:["admissions","staff_management","communications","school_configuration"],
  academic_head:["academics","admissions","communications"],
  bursar:["finance_collection"],
  accountant:["finance_approval","audit"],
  teacher:["academics"],
  tutor:["academics"],
  transport_manager:["transport"],
  driver:["transport"],
  security_guard:["gate"],
  auditor:["audit"],
};

export function legacyAuthorityScopes(role:Role):AuthorityScope[]{return legacy[role]??[];}
export function hasAuthority(scopes:AuthorityScope[],scope:AuthorityScope){return scopes.includes(scope);}
export function humanizeRole(role:Role){return role.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());}
