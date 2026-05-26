import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import {
  getSessionUser,
  isEmailVerified,
  isProfileComplete,
} from "@/lib/auth/profile";
import type { UserRole } from "@/types/roles";

function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default async function AppGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }

  const { user, profile } = await getSessionUser();

  if (!user) redirect("/login");
  if (!isEmailVerified(user)) redirect("/verify-email");
  if (!isProfileComplete(profile)) redirect("/onboarding");

  const role = (profile?.role ?? "client") as UserRole;

  return <AppShell role={role}>{children}</AppShell>;
}
