import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, UserCheck } from "lucide-react";

import { getSessionUser } from "@/lib/auth/profile";
import { cn } from "@/lib/utils";

export default async function AdminPage() {
  const { profile } = await getSessionUser();
  if (profile?.role !== "admin") redirect("/");

  const cards = [
    {
      href: "/admin/jobs",
      title: "Jobs",
      description: "Add, rename, and activate or deactivate job sites.",
      icon: Briefcase,
    },
    {
      href: "/admin/approvals",
      title: "Approvals",
      description: "Approve or reject new employee and client signups.",
      icon: UserCheck,
    },
  ] as const;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="text-3xl md:text-4xl">Admin</h1>
        <p className="mt-1 text-muted-foreground">
          Company owner controls for jobs and account access.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-11 flex-col gap-2 rounded-lg border border-border bg-background p-5 transition-colors",
              "hover:border-primary hover:bg-muted/40"
            )}
          >
            <Icon className="size-6 text-primary" aria-hidden />
            <h2 className="font-heading text-xl">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
