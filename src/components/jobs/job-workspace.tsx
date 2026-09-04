import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Timer,
  ListTodo,
} from "lucide-react";

import { FeedMobileCard } from "@/components/feed/feed-mobile-card";
import { PageTrail } from "@/components/layout/page-breadcrumbs";
import { buttonVariants } from "@/components/ui/button";
import {
  formatTaskRange,
  statusLabel,
  type JobWorkspaceOverview,
} from "@/lib/jobs/workspace";
import { cn } from "@/lib/utils";

function OverviewCard({
  title,
  icon: Icon,
  children,
  empty,
  href,
  linkLabel,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  empty: boolean;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-primary" aria-hidden />
          <h2 className="font-heading text-lg">{title}</h2>
        </div>
        {href && linkLabel ? (
          <Link
            href={href}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">Nothing here right now.</p>
      ) : (
        children
      )}
    </section>
  );
}

export function JobWorkspace({ data }: { data: JobWorkspaceOverview }) {
  if (!data.job) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <PageTrail
          items={[{ label: "Jobs", href: "/jobs" }, { label: "Not found" }]}
          fallbackHref="/jobs"
        />
        <p className="text-sm text-destructive">
          {data.error ?? "Job not found."}
        </p>
      </main>
    );
  }

  const jobId = data.job.id;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageTrail
            items={[
              { label: "Jobs", href: "/jobs" },
              { label: data.job.name },
            ]}
            fallbackHref="/jobs"
          />
          <h1 className="font-heading text-3xl md:text-4xl">{data.job.name}</h1>
          <p className="mt-1 text-muted-foreground">
            Live overview for this site — tasks, crew on the clock, and daily
            logs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/schedule?job=${jobId}&from=job`}
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
          >
            Schedule
          </Link>
          <Link
            href={`/documents?job=${jobId}&from=job`}
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}
          >
            Docs
          </Link>
          <Link
            href="/logs/new"
            className={cn(buttonVariants(), "min-h-11")}
          >
            New log
          </Link>
        </div>
      </header>

      {!data.schemaReady ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Some schedule or timeclock tables are missing. Run the schedule /
          timeclock migrations in Supabase if this persists.
        </p>
      ) : null}

      {data.error ? (
        <p className="text-sm text-destructive" role="alert">
          {data.error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <OverviewCard
          title="Ongoing tasks"
          icon={ListTodo}
          empty={data.ongoingTasks.length === 0}
          href={`/schedule?job=${jobId}&from=job`}
          linkLabel="Open schedule"
        >
          <ul className="space-y-2">
            {data.ongoingTasks.map((t) => (
              <li key={t.id} className="text-sm">
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {statusLabel(t.status)} ·{" "}
                  {formatTaskRange(t.start_date, t.end_date)}
                </p>
              </li>
            ))}
          </ul>
        </OverviewCard>

        <OverviewCard
          title="Clocked in"
          icon={Timer}
          empty={data.clockedIn.length === 0}
          href="/timeclock"
          linkLabel="Time clock"
        >
          <ul className="space-y-2">
            {data.clockedIn.map((person) => (
              <li key={person.id} className="text-sm font-medium">
                {person.name}
              </li>
            ))}
          </ul>
        </OverviewCard>

        <OverviewCard
          title="Upcoming (14 days)"
          icon={CalendarDays}
          empty={data.upcomingTasks.length === 0}
          href={`/schedule?job=${jobId}&from=job`}
          linkLabel="Open schedule"
        >
          <ul className="space-y-2">
            {data.upcomingTasks.map((t) => (
              <li key={t.id} className="text-sm">
                <p className="font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {statusLabel(t.status)} ·{" "}
                  {formatTaskRange(t.start_date, t.end_date)}
                </p>
              </li>
            ))}
          </ul>
        </OverviewCard>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" aria-hidden />
          <h2 className="font-heading text-xl">Daily logs</h2>
        </div>
        {data.logs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No daily logs for this job yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            {data.logs.map((log) => (
              <FeedMobileCard key={log.id} log={log} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
