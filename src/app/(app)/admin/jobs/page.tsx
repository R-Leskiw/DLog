import { redirect } from "next/navigation";

import { JobsAdmin } from "@/components/admin/jobs-admin";
import { PageTrail } from "@/components/layout/page-breadcrumbs";
import { getSessionUser } from "@/lib/auth/profile";

export default async function AdminJobsPage() {
  const { profile } = await getSessionUser();
  if (profile?.role !== "admin") redirect("/");

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
      <header className="space-y-1">
        <PageTrail
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Jobs" },
          ]}
          fallbackHref="/admin"
        />
        <h1 className="text-3xl md:text-4xl">Jobs</h1>
        <p className="text-muted-foreground">
          Manage job sites shown when employees create daily logs. Add every
          client contact (both spouses, extras) so estimates go to all of them.
        </p>
      </header>
      <JobsAdmin />
    </main>
  );
}
