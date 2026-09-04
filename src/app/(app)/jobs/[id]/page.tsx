import { redirect } from "next/navigation";

import { JobWorkspace } from "@/components/jobs/job-workspace";
import { getSessionUser } from "@/lib/auth/profile";
import { loadJobWorkspace } from "@/lib/jobs/workspace";
import { isStaffRole } from "@/types/roles";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { profile } = await getSessionUser();
  if (!isStaffRole(profile?.role)) redirect("/");

  const { id } = await params;
  const data = await loadJobWorkspace(id);

  return <JobWorkspace data={data} />;
}
