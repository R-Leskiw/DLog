import type { UserRole } from "@/types/roles";

const KEY = "buildtrack_pending_role";

export function setPendingRole(role: UserRole) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, role);
}

export function getPendingRole(): UserRole | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(KEY);
  if (v === "employee" || v === "client") return v;
  return null;
}

export function clearPendingRole() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
