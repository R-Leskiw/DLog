import type { ComponentType, ReactNode } from "react";
import { CalendarDays, ClipboardList, MessageCircle, Timer } from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export type DashboardOverview = {
  todaysTasks: { id: string; title: string; jobName: string | null }[];
  recentLogs: { id: string; title: string | null; date: string; jobName: string | null }[];
  unreadCount: number;
  clockedIn: { id: string; name: string; jobName: string | null }[];
  schemaReady: boolean;
};

function isMissingRelation(message: string | undefined) {
  if (!message) return false;
  return /does not exist|schema cache/i.test(message);
}

export async function loadDashboardOverview(): Promise<DashboardOverview> {
  const empty: DashboardOverview = {
    todaysTasks: [],
    recentLogs: [],
    unreadCount: 0,
    clockedIn: [],
    schemaReady: true,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  const today = new Date().toISOString().slice(0, 10);

  const tasksRes = await supabase
    .from("schedule_tasks")
    .select("id, title, start_date, end_date, jobs(name)")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("start_date")
    .limit(5);

  if (tasksRes.error && isMissingRelation(tasksRes.error.message)) {
    empty.schemaReady = false;
  }

  const logsRes = await supabase
    .from("daily_logs")
    .select("id, title, date, jobs(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  const messagesRes = await supabase
    .from("messages")
    .select("id, sender_id")
    .neq("sender_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const readsRes = await supabase
    .from("message_reads")
    .select("message_id")
    .eq("user_id", user.id);

  const clockRes = await supabase
    .from("time_entries")
    .select("id, user_id, job_id, jobs(name)")
    .is("clock_out", null);

  if (
    [tasksRes.error, messagesRes.error, readsRes.error, clockRes.error].some(
      (e) => e && isMissingRelation(e.message)
    )
  ) {
    empty.schemaReady = false;
  }

  const readIds = new Set((readsRes.data ?? []).map((r) => r.message_id));
  const unreadCount = (messagesRes.data ?? []).filter(
    (m) => !readIds.has(m.id)
  ).length;

  const clockRows = clockRes.data ?? [];
  const clockUserIds = [
    ...new Set(clockRows.map((r) => r.user_id).filter(Boolean)),
  ] as string[];
  const nameById = new Map<string, string>();
  if (clockUserIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", clockUserIds);
    for (const p of profiles ?? []) {
      nameById.set(p.id, p.full_name?.trim() || "Team member");
    }
  }

  function jobName(
    jobs: { name: string } | { name: string }[] | null | undefined
  ) {
    if (!jobs) return null;
    return Array.isArray(jobs) ? jobs[0]?.name ?? null : jobs.name;
  }

  return {
    schemaReady: empty.schemaReady,
    todaysTasks: (tasksRes.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      jobName: jobName(t.jobs as { name: string } | { name: string }[] | null),
    })),
    recentLogs: (logsRes.data ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      date: l.date,
      jobName: jobName(l.jobs as { name: string } | { name: string }[] | null),
    })),
    unreadCount,
    clockedIn: clockRows.map((r) => ({
      id: r.id,
      name: nameById.get(r.user_id) ?? "Team member",
      jobName: jobName(r.jobs as { name: string } | { name: string }[] | null),
    })),
  };
}

function Widget({
  title,
  icon: Icon,
  children,
  href,
  empty,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
  href?: string;
  empty?: boolean;
}) {
  const inner = (
    <Card className="h-full min-h-44">
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-primary" aria-hidden />
          <CardTitle className="font-heading text-lg">{title}</CardTitle>
        </div>
        {empty ? (
          <CardDescription>Nothing to show yet.</CardDescription>
        ) : null}
      </CardHeader>
      <div className="px-4 pb-2">{children}</div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full min-h-11">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function DashboardOverview({ data }: { data: DashboardOverview }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header>
        <h1 className="font-heading text-3xl md:text-4xl">Overview</h1>
        <p className="mt-1 text-muted-foreground">
          Today’s jobs, logs, messages, and who’s on the clock.
        </p>
      </header>

      {!data.schemaReady ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Run{" "}
          <code className="rounded bg-muted px-1 text-xs">
            supabase/migrations/0004_schedule_timeclock_messages_estimates.sql
          </code>{" "}
          in the Supabase SQL Editor to enable schedule, timeclock, and unread
          chat counts.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Widget
          title="Today’s schedule"
          icon={CalendarDays}
          href="/schedule"
          empty={data.todaysTasks.length === 0}
        >
          <ul className="space-y-2 text-sm">
            {data.todaysTasks.map((t) => (
              <li key={t.id}>
                <p className="font-medium">{t.title}</p>
                {t.jobName ? (
                  <p className="text-xs text-muted-foreground">{t.jobName}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Widget>

        <Widget
          title="Recent daily logs"
          icon={ClipboardList}
          href="/"
          empty={data.recentLogs.length === 0}
        >
          <ul className="space-y-2 text-sm">
            {data.recentLogs.map((l) => (
              <li key={l.id}>
                <p className="font-medium">{l.title?.trim() || "Daily log"}</p>
                <p className="text-xs text-muted-foreground">
                  {l.date}
                  {l.jobName ? ` · ${l.jobName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Widget>

        <Widget title="Unread messages" icon={MessageCircle}>
          <p className="font-heading text-4xl tabular-nums">{data.unreadCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Team chat messages you haven’t opened yet.
          </p>
        </Widget>

        <Widget
          title="Clocked in"
          icon={Timer}
          href="/timeclock"
          empty={data.clockedIn.length === 0}
        >
          <ul className="space-y-2 text-sm">
            {data.clockedIn.map((p) => (
              <li key={p.id}>
                <p className="font-medium">{p.name}</p>
                {p.jobName ? (
                  <p className="text-xs text-muted-foreground">{p.jobName}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Widget>
      </div>
    </main>
  );
}
