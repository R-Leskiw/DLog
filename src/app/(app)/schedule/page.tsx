import { redirect } from "next/navigation";

import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { getSessionUser } from "@/lib/auth/profile";
import { isStaffRole } from "@/types/roles";

export default async function SchedulePage() {
  const { profile } = await getSessionUser();
  if (!isStaffRole(profile?.role)) redirect("/");

  return <ScheduleBoard canEdit={profile?.role === "admin"} />;
}
