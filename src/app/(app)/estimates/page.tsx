import { redirect } from "next/navigation";

import { EstimatesBoard } from "@/components/estimates/estimates-board";
import { getSessionUser } from "@/lib/auth/profile";
import { isStaffRole } from "@/types/roles";

export default async function EstimatesPage() {
  const { profile } = await getSessionUser();
  if (!isStaffRole(profile?.role)) redirect("/");

  return <EstimatesBoard canEdit={profile?.role === "admin"} />;
}
