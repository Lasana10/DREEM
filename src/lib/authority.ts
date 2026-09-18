import type { Role } from "../domain/types";

export type AuthorityScope =
  | "institutional_leadership"
  | "academics_delivery"
  | "academics_approval"
  | "admissions_intake"
  | "admissions_decision"
  | "finance_collection"
  | "finance_approval"
  | "safeguarding"
  | "transport_management"
  | "transport_operation"
  | "gate"
  | "staff_management"
  | "communications_publish"
  | "communications_approve"
  | "audit"
  | "school_configuration";

const legacy: Partial<Record<Role, AuthorityScope[]>> = {
  platform_founder:["institutional_leadership","academics_delivery","academics_approval","admissions_intake","admissions_decision","finance_collection","finance_approval","safeguarding","transport_management","transport_operation","gate","staff_management","communications_publish","communications_approve","audit","school_configuration"],
  school_owner:["institutional_leadership","academics_approval","admissions_decision","finance_approval","safeguarding","transport_management","staff_management","communications_publish","communications_approve","audit","school_configuration"],
  principal:["institutional_leadership","academics_approval","admissions_decision","finance_approval","safeguarding","transport_management","staff_management","communications_publish","communications_approve","school_configuration"],
  administrator:["admissions_intake","staff_management","communications_publish","school_configuration"],
  academic_head:["academics_approval","admissions_decision","communications_publish"],
  bursar:["finance_collection"],
  accountant:["finance_approval","audit"],
  teacher:["academics_delivery"],
  tutor:["academics_delivery"],
  transport_manager:["transport_management","communications_publish"],
  driver:["transport_operation"],
  security_guard:["gate"],
  auditor:["audit"],
};

export function legacyAuthorityScopes(role:Role):AuthorityScope[]{return legacy[role]??[];}
export function hasAuthority(scopes:AuthorityScope[],scope:AuthorityScope){return scopes.includes(scope);}
export function humanizeRole(role:Role){return role.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());}
