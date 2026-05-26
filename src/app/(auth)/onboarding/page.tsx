import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import {
  getSessionUser,
  isEmailVerified,
  isProfileComplete,
} from "@/lib/auth/profile";
import type { UserRole } from "@/types/roles";

export default async function OnboardingPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");
  if (!isEmailVerified(user)) redirect("/verify-email");
  if (isProfileComplete(profile)) redirect("/");

  const initialRole = (profile?.role as UserRole) ?? null;

  return <OnboardingForm initialRole={initialRole} />;
}
