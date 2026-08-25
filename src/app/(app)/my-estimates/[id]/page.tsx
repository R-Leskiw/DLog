import { redirect } from "next/navigation";

import { ClientEstimateDetail } from "@/components/estimates/client-estimate-detail";
import { getSessionUser } from "@/lib/auth/profile";

export default async function MyEstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await getSessionUser();
  if (profile?.role !== "client") redirect("/");
  const { id } = await params;
  return <ClientEstimateDetail estimateId={id} />;
}
