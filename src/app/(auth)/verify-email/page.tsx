import { redirect } from "next/navigation";

import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";
import { getSessionUser, isEmailVerified } from "@/lib/auth/profile";

export default async function VerifyEmailPage() {
  const { user } = await getSessionUser();
  if (!user) redirect("/login");
  if (isEmailVerified(user)) redirect("/onboarding");

  return <VerifyEmailPanel email={user.email ?? ""} />;
}
