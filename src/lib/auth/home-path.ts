import { isStaffRole, type UserRole } from "@/types/roles";

export function postLoginPath(role: UserRole | null | undefined): string {
  return isStaffRole(role) ? "/dashboard" : "/";
}
