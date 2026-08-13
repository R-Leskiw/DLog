export const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/onboarding",
  "/pending-approval",
] as const;

export const EMPLOYEE_ONLY_PREFIXES = ["/logs/new", "/chat"] as const;

export const ADMIN_ONLY_PREFIXES = ["/admin"] as const;

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`)
  );
}

export function isEmployeeOnlyRoute(pathname: string): boolean {
  return EMPLOYEE_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function isProtectedAppRoute(pathname: string): boolean {
  if (isAuthRoute(pathname)) return false;
  if (pathname === "/") return true;
  return (
    pathname.startsWith("/logs") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/admin")
  );
}
