import { redirect } from "next/navigation";

import { TimeclockPanel } from "@/components/timeclock/timeclock-panel";
import { getSessionUser } from "@/lib/auth/profile";
import { isStaffRole } from "@/types/roles";

export default async function TimeclockPage() {
  const { profile } = await getSessionUser();
  if (!isStaffRole(profile?.role)) redirect("/");

  return <TimeclockPanel isAdmin={profile?.role === "admin"} />;
}
