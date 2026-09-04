import { createClient } from "@/lib/supabase/server";
import type { FeedLog } from "@/types/feed";
import {
  statusLabel,
  type ScheduleStatus,
} from "@/types/schedule";

export type JobWorkspaceOverview = {
  job: { id: string; name: string; is_active: boolean } | null;
  ongoingTasks: {
    id: string;
    title: string;
    status: ScheduleStatus;
    start_date: string;
    end_date: string;
  }[];
  upcomingTasks: {
    id: string;
    title: string;
    status: ScheduleStatus;
    start_date: string;
    end_date: string;
  }[];
  clockedIn: { id: string; name: string }[];
  logs: FeedLog[];
  schemaReady: boolean;
  error: string | null;
};

function isMissingRelation(message: string | undefined) {
  if (!message) return false;
  return /does not exist|schema cache/i.test(message);
}

export function formatTaskRange(start: string, end: string) {
  try {
    const a = new Date(start + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const b = new Date(end + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    return a === b ? a : `${a} – ${b}`;
  } catch {
    return `${start} – ${end}`;
  }
}

export { statusLabel };

export async function loadJobWorkspace(
  jobId: string
): Promise<JobWorkspaceOverview> {
  const empty: JobWorkspaceOverview = {
    job: null,
    ongoingTasks: [],
    upcomingTasks: [],
    clockedIn: [],
    logs: [],
    schemaReady: true,
    error: null,
  };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const jobRes = await supabase
    .from("jobs")
    .select("id, name, is_active")
    .eq("id", jobId)
    .maybeSingle();

  if (jobRes.error) {
    return { ...empty, error: jobRes.error.message };
  }
  if (!jobRes.data) {
    return { ...empty, error: "Job not found." };
  }

  const [tasksRes, clockRes, logsRes] = await Promise.all([
    supabase
      .from("schedule_tasks")
      .select("id, title, status, start_date, end_date")
      .eq("job_id", jobId)
      .order("start_date"),
    supabase
      .from("time_entries")
      .select("id, user_id")
      .eq("job_id", jobId)
      .is("clock_out", null),
    supabase
      .from("daily_logs")
      .select(
        "id, title, date, work_performed, image_urls, created_at, created_by, jobs(id, name)"
      )
      .eq("job_id", jobId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (
    [tasksRes.error, clockRes.error].some(
      (e) => e && isMissingRelation(e.message)
    )
  ) {
    empty.schemaReady = false;
  }

  if (tasksRes.error && !isMissingRelation(tasksRes.error.message)) {
    return {
      ...empty,
      job: jobRes.data,
      error: tasksRes.error.message,
      schemaReady: empty.schemaReady,
    };
  }
  if (logsRes.error) {
    return {
      ...empty,
      job: jobRes.data,
      error: logsRes.error.message,
    };
  }

  const tasks = tasksRes.data ?? [];
  const ongoingTasks = tasks
    .filter(
      (t) =>
        t.status !== "done" &&
        t.start_date <= today &&
        t.end_date >= today
    )
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as ScheduleStatus,
      start_date: t.start_date,
      end_date: t.end_date,
    }));

  const upcomingTasks = tasks
    .filter(
      (t) =>
        t.status !== "done" &&
        t.start_date > today &&
        t.start_date <= horizonIso
    )
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status as ScheduleStatus,
      start_date: t.start_date,
      end_date: t.end_date,
    }));

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

  const authorIds = [
    ...new Set(
      (logsRes.data ?? []).map((r) => r.created_by).filter(Boolean)
    ),
  ] as string[];
  const authorById = new Map<string, string | null>();
  if (authorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    for (const p of profiles ?? []) {
      authorById.set(p.id, p.full_name);
    }
  }

  const logs: FeedLog[] = (logsRes.data ?? []).map((row) => {
    const jobRaw = row.jobs as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const job = Array.isArray(jobRaw) ? jobRaw[0] ?? null : jobRaw;
    return {
      id: row.id,
      title: row.title,
      date: row.date,
      work_performed: row.work_performed,
      image_urls: row.image_urls,
      created_at: row.created_at,
      created_by: row.created_by,
      job: job ? { id: job.id, name: job.name } : null,
      author: row.created_by
        ? { full_name: authorById.get(row.created_by) ?? null }
        : null,
    };
  });

  return {
    job: jobRes.data,
    ongoingTasks,
    upcomingTasks,
    clockedIn: clockRows.map((r) => ({
      id: r.id,
      name: nameById.get(r.user_id) || "Team member",
    })),
    logs,
    schemaReady: empty.schemaReady,
    error:
      clockRes.error && !isMissingRelation(clockRes.error.message)
        ? clockRes.error.message
        : null,
  };
}

export async function loadActiveJobs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select("id, name, is_active")
    .eq("is_active", true)
    .order("name");
  return {
    jobs: (data ?? []) as { id: string; name: string; is_active: boolean }[],
    error: error?.message ?? null,
  };
}
