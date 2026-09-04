import { redirect } from "next/navigation";

import { DocumentsBoard } from "@/components/documents/documents-board";
import { getSessionUser } from "@/lib/auth/profile";
import { isStaffRole } from "@/types/roles";

export default async function DocumentsPage() {
  const { profile } = await getSessionUser();
  if (!isStaffRole(profile?.role)) redirect("/");

  return (
    <DocumentsBoard canManageFolders={profile?.role === "admin"} />
  );
}
