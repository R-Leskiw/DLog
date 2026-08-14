import { redirect } from "next/navigation";

import { Feed } from "@/components/feed/feed";
import { AppShell } from "@/components/layout/app-shell";
import { LandingPage } from "@/components/marketing/landing-page";
import {
  getSessionUser,
  isApproved,
  isEmailVerified,
  isProfileComplete,
} from "@/lib/auth/profile";
import { isStaffRole } from "@/types/roles";

export default async function HomePage() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return <LandingPage />;
  }

  const { user, profile } = await getSessionUser();

  if (!user) {
    return <LandingPage />;
  }

  if (!isEmailVerified(user)) {
    redirect("/verify-email");
  }

  if (!isProfileComplete(profile)) {
    redirect("/onboarding");
  }

  if (!isApproved(profile)) {
    redirect("/pending-approval");
  }

  const role = profile!.role ?? "client";

  return (
    <AppShell role={role}>
      <Feed canCreateLogs={isStaffRole(role)} />
    </AppShell>
  );
}
