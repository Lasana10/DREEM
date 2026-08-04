import { rolePermissions } from "../shared/data";
import type { PermissionId, RoleId, UserProfile } from "../shared/types";

export function hasRolePermission(role: RoleId, permission: PermissionId) {
  return rolePermissions[role].includes(permission);
}

export function hasUserPermission(
  user: UserProfile | null | undefined,
  permission: PermissionId
) {
  if (!user) {
    return false;
  }

  return hasRolePermission(user.role, permission);
}
