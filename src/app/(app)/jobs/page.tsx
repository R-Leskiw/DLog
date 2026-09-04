import { redirect } from "next/navigation";

import { JobsLanding } from "@/components/jobs/jobs-landing";
import { getSessionUser } from "@/lib/auth/profile";
import { isStaffRole } from "@/types/roles";

export default async function JobsPage() {
  const { profile } = await getSessionUser();
  if (!isStaffRole(profile?.role)) redirect("/");

  return <JobsLanding />;
}
