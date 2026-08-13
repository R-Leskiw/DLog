import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import {
  getSessionUser,
  isEmailVerified,
  isProfileComplete,
} from "@/lib/auth/profile";
import type { RequestableRole } from "@/types/roles";

export default async function OnboardingPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");
  if (!isEmailVerified(user)) redirect("/verify-email");
  if (isProfileComplete(profile)) {
    if (profile?.approval_status === "approved") redirect("/");
    redirect("/pending-approval");
  }

  const initialRole =
    profile?.role === "employee" || profile?.role === "client"
      ? (profile.role as RequestableRole)
      : null;

  return <OnboardingForm initialRole={initialRole} />;
}
