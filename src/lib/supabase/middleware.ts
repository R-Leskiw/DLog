import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import {
  isAuthRoute,
  isEmployeeOnlyRoute,
  isProtectedAppRoute,
} from "@/lib/auth/routes";
import type { UserRole } from "@/types/roles";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  if (!url || !anon) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = Boolean(user);
  const isVerified = Boolean(user?.email_confirmed_at);

  let role: UserRole | null = null;
  let profileComplete = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();
    role = (profile?.role as UserRole) ?? null;
    profileComplete = Boolean(profile?.full_name?.trim() && profile?.role);
  }

  const redirect = (path: string) => {
    const next = NextResponse.redirect(new URL(path, request.url));
    supabaseResponse.cookies.getAll().forEach((c) => {
      next.cookies.set(c.name, c.value);
    });
    return next;
  };

  if (isLoggedIn && isAuthRoute(pathname)) {
    if (!isVerified) return redirect("/verify-email");
    if (!profileComplete) return redirect("/onboarding");
    return redirect("/");
  }

  if (!isLoggedIn && isProtectedAppRoute(pathname)) {
    return redirect("/login");
  }

  if (isLoggedIn && !isVerified && pathname !== "/verify-email") {
    if (isProtectedAppRoute(pathname) || pathname === "/") {
      return redirect("/verify-email");
    }
  }

  if (
    isLoggedIn &&
    isVerified &&
    !profileComplete &&
    pathname !== "/onboarding"
  ) {
    if (isProtectedAppRoute(pathname) || pathname === "/") {
      return redirect("/onboarding");
    }
  }

  if (isLoggedIn && isVerified && profileComplete) {
    if (role === "client" && isEmployeeOnlyRoute(pathname)) {
      return redirect("/");
    }
  }

  if (isLoggedIn && isVerified && profileComplete && pathname === "/") {
    return supabaseResponse;
  }

  return supabaseResponse;
}
