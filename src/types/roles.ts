/** Supabase-aligned roles from PROJECT_SPEC.md (+ admin for owners) */
export type UserRole = "employee" | "client" | "admin";

/** Roles users may request at signup (never admin). */
export type RequestableRole = "employee" | "client";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === "employee" || role === "admin";
}
