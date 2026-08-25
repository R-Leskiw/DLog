import { redirect } from "next/navigation";

import { ClientEstimatesList } from "@/components/estimates/client-estimates-list";
import { getSessionUser } from "@/lib/auth/profile";

export default async function MyEstimatesPage() {
  const { profile } = await getSessionUser();
  if (profile?.role !== "client") redirect("/");
  return <ClientEstimatesList />;
}
