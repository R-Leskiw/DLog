import { redirect } from "next/navigation";

import { DashboardOverview, loadDashboardOverview } from "@/components/dashboard/dashboard-overview";
import { getSessionUser } from "@/lib/auth/profile";
import { isStaffRole } from "@/types/roles";

export default async function DashboardPage() {
  const { profile } = await getSessionUser();
  if (!isStaffRole(profile?.role)) redirect("/");

  const data = await loadDashboardOverview();
  return <DashboardOverview data={data} />;
}
