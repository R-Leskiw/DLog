import { getSessionUser } from "@/lib/auth/profile";
import { isStaffRole } from "@/types/roles";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function originFrom(request: Request) {
  return new URL(request.url).origin;
}

export async function requireStaffSession() {
  const { user, profile } = await getSessionUser();
  if (!user || !isStaffRole(profile?.role)) {
    return { user: null, profile: null, error: jsonError("Unauthorized.", 401) };
  }
  return { user, profile, error: null };
}

export async function requireAdminSession() {
  const { user, profile } = await getSessionUser();
  if (!user || profile?.role !== "admin") {
    return { user: null, profile: null, error: jsonError("Unauthorized.", 401) };
  }
  return { user, profile, error: null };
}

export async function requireApprovedSession() {
  const { user, profile } = await getSessionUser();
  if (!user || !profile) {
    return { user: null, profile: null, error: jsonError("Unauthorized.", 401) };
  }
  return { user, profile, error: null };
}

export function pdfHeaders(filename: string) {
  return {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };
}
