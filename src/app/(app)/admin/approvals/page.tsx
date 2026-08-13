import Link from "next/link";
import { redirect } from "next/navigation";

import { ApprovalsAdmin } from "@/components/admin/approvals-admin";
import { getSessionUser } from "@/lib/auth/profile";

export default async function AdminApprovalsPage() {
  const { profile } = await getSessionUser();
  if (profile?.role !== "admin") redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          <Link href="/admin" className="underline hover:text-foreground">
            Admin
          </Link>{" "}
          / Approvals
        </p>
        <h1 className="text-3xl md:text-4xl">Approvals</h1>
        <p className="text-muted-foreground">
          Review new signups. Approve as Employee or Client, or reject access.
        </p>
      </header>
      <ApprovalsAdmin />
    </main>
  );
}
