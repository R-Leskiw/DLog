"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  ScheduleTimeline,
  WINDOW_DAYS,
} from "@/components/schedule/schedule-timeline";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import {
  addDays,
  formatShort,
  overlaps,
  startOfWeekMonday,
  toISODate,
} from "@/lib/schedule/dates";
import type { Job } from "@/types/logs";
import {
  SCHEDULE_STATUSES,
  statusLabel,
  type ScheduleStaff,
  type ScheduleStatus,
  type ScheduleTask,
} from "@/types/schedule";

const emptyForm = {
  title: "",
  jobId: "",
  start: toISODate(new Date()),
  end: toISODate(new Date()),
  status: "planned" as ScheduleStatus,
  notes: "",
  assigneeIds: [] as string[],
};

function isMissingRelation(message: string | undefined) {
  if (!message) return false;
  return /does not exist|schema cache/i.test(message);
}

function jobNameFromJoin(
  jobs: { name: string } | { name: string }[] | null | undefined
) {
  if (!jobs) return null;
  return Array.isArray(jobs) ? jobs[0]?.name ?? null : jobs.name;
}

export function ScheduleBoard({ canEdit }: { canEdit: boolean }) {
  return (
    <Suspense
      fallback={
        <main className="px-4 py-6 text-sm text-muted-foreground">
          Loading schedule…
        </main>
      }
    >
      <ScheduleBoardInner canEdit={canEdit} />
    </Suspense>
  );
}

function ScheduleBoardInner({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const jobFilter = searchParams.get("job") || "all";

  const [anchor, setAnchor] = useState(() => startOfWeekMonday(new Date()));
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [staff, setStaff] = useState<ScheduleStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [jobQuery, setJobQuery] = useState("");

  const rangeStart = toISODate(anchor);
  const rangeEnd = toISODate(addDays(anchor, WINDOW_DAYS - 1));
  const days = useMemo(
    () =>
      Array.from({ length: WINDOW_DAYS }, (_, i) =>
        toISODate(addDays(anchor, i))
      ),
    [anchor]
  );
  const todayIso = toISODate(new Date());
  const selectedJob = jobs.find((j) => j.id === jobFilter) ?? null;
  const isAllJobs = jobFilter === "all";

  const setJobFilter = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === "all") params.delete("job");
      else params.set("job", id);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const start = toISODate(anchor);
    const end = toISODate(addDays(anchor, WINDOW_DAYS - 1));

    const [tasksRes, assignRes, jobsRes, staffRes] = await Promise.all([
      supabase
        .from("schedule_tasks")
        .select("id, job_id, title, notes, start_date, end_date, status, jobs(name)")
        .lte("start_date", end)
        .gte("end_date", start)
        .order("start_date"),
      supabase.from("schedule_assignments").select("task_id, user_id"),
      supabase.from("jobs").select("id, name, is_active").order("name"),
      supabase
        .from("profiles")
        .select("id, full_name, role, approval_status")
        .eq("approval_status", "approved")
        .in("role", ["employee", "admin"])
        .order("full_name"),
    ]);

    if (tasksRes.error && isMissingRelation(tasksRes.error.message)) {
      setSchemaReady(false);
      setError(null);
      setLoading(false);
      return;
    }
    setSchemaReady(true);

    if (tasksRes.error) {
      setError(tasksRes.error.message);
      setLoading(false);
      return;
    }

    const assigneesByTask = new Map<string, string[]>();
    for (const row of assignRes.data ?? []) {
      const list = assigneesByTask.get(row.task_id) ?? [];
      list.push(row.user_id);
      assigneesByTask.set(row.task_id, list);
    }

    setTasks(
      (tasksRes.data ?? []).map((row) => ({
        id: row.id,
        job_id: row.job_id,
        title: row.title,
        notes: row.notes,
        start_date: row.start_date,
        end_date: row.end_date,
        status: row.status as ScheduleStatus,
        jobName: jobNameFromJoin(
          row.jobs as { name: string } | { name: string }[] | null
        ),
        assigneeIds: assigneesByTask.get(row.id) ?? [],
      }))
    );
    setJobs((jobsRes.data as Job[]) ?? []);
    setStaff(
      (staffRes.data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
      }))
    );
    setError(
      assignRes.error?.message ||
        jobsRes.error?.message ||
        staffRes.error?.message ||
        null
    );
    setLoading(false);
  }, [anchor]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const rangeTasks = useMemo(
    () =>
      tasks.filter((t) =>
        overlaps(t.start_date, t.end_date, rangeStart, rangeEnd)
      ),
    [tasks, rangeStart, rangeEnd]
  );

  const visibleTasks = isAllJobs
    ? rangeTasks
    : rangeTasks.filter((t) => t.job_id === jobFilter);

  const jobSummaries = useMemo(() => {
    const q = jobQuery.trim().toLowerCase();
    const byId = new Map<
      string,
      { job: Job; count: number; blocked: number }
    >();
    for (const job of jobs) {
      if (!job.is_active) continue;
      byId.set(job.id, { job, count: 0, blocked: 0 });
    }
    for (const task of rangeTasks) {
      if (!task.job_id) continue;
      const existing = byId.get(task.job_id);
      if (existing) {
        existing.count += 1;
        if (task.status === "blocked") existing.blocked += 1;
      } else {
        const job = jobs.find((j) => j.id === task.job_id);
        if (job) {
          byId.set(job.id, {
            job,
            count: 1,
            blocked: task.status === "blocked" ? 1 : 0,
          });
        }
      }
    }
    return [...byId.values()]
      .filter(({ job }) =>
        q ? job.name.toLowerCase().includes(q) : true
      )
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.job.name.localeCompare(b.job.name);
      });
  }, [jobs, rangeTasks, jobQuery]);

  const groupedForAll = useMemo(() => {
    const groups: { id: string; name: string; tasks: ScheduleTask[] }[] = [];
    for (const job of jobs) {
      const list = rangeTasks.filter((t) => t.job_id === job.id);
      if (!job.is_active && list.length === 0) continue;
      groups.push({ id: job.id, name: job.name, tasks: list });
    }
    const unassigned = rangeTasks.filter((t) => !t.job_id);
    if (unassigned.length) {
      groups.push({ id: "none", name: "Unassigned", tasks: unassigned });
    }
    return groups;
  }, [jobs, rangeTasks]);

  function openNew() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      start: todayIso,
      end: todayIso,
      jobId: isAllJobs ? "" : jobFilter,
    });
    setFormOpen(true);
  }

  function openEdit(task: ScheduleTask) {
    if (!canEdit) return;
    setEditingId(task.id);
    setForm({
      title: task.title,
      jobId: task.job_id ?? "",
      start: task.start_date,
      end: task.end_date,
      status: task.status,
      notes: task.notes ?? "",
      assigneeIds: [...task.assigneeIds],
    });
    setFormOpen(true);
  }

  function toggleAssignee(id: string) {
    setForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(id)
        ? prev.assigneeIds.filter((x) => x !== id)
        : [...prev.assigneeIds, id],
    }));
  }

  function nameFor(id: string) {
    return staff.find((s) => s.id === id)?.full_name?.trim() || "Team member";
  }

  async function saveTask(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return;
    if (form.end < form.start) {
      setError("End date must be on or after the start date.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);

    const payload = {
      title,
      job_id: form.jobId || null,
      start_date: form.start,
      end_date: form.end,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    let taskId = editingId;
    if (editingId) {
      const { error: updateError } = await supabase
        .from("schedule_tasks")
        .update(payload)
        .eq("id", editingId);
      if (updateError) {
        setSaving(false);
        setError(updateError.message);
        return;
      }
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error: insertError } = await supabase
        .from("schedule_tasks")
        .insert({ ...payload, created_by: user?.id ?? null })
        .select("id")
        .single();
      if (insertError || !data) {
        setSaving(false);
        setError(insertError?.message ?? "Could not create task.");
        return;
      }
      taskId = data.id;
    }

    if (taskId) {
      const { error: delError } = await supabase
        .from("schedule_assignments")
        .delete()
        .eq("task_id", taskId);
      if (delError) {
        setSaving(false);
        setError(delError.message);
        return;
      }
      if (form.assigneeIds.length) {
        const { error: asgError } = await supabase
          .from("schedule_assignments")
          .insert(
            form.assigneeIds.map((user_id) => ({ task_id: taskId, user_id }))
          );
        if (asgError) {
          setSaving(false);
          setError(asgError.message);
          return;
        }
      }
    }

    setSaving(false);
    setFormOpen(false);
    await load();
  }

  async function deleteTask() {
    if (!editingId) return;
    if (!window.confirm("Delete this schedule task?")) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    const { error: delError } = await supabase
      .from("schedule_tasks")
      .delete()
      .eq("id", editingId);
    setSaving(false);
    if (delError) {
      setError(delError.message);
      return;
    }
    setFormOpen(false);
    await load();
  }

  const heading = isAllJobs
    ? "All jobs"
    : selectedJob?.name ?? "Job schedule";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {!isAllJobs ? (
            <button
              type="button"
              className="mb-1 min-h-11 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setJobFilter("all")}
            >
              ← All jobs
            </button>
          ) : null}
          <h1 className="font-heading text-3xl md:text-4xl">{heading}</h1>
          <p className="mt-1 text-muted-foreground">
            {isAllJobs
              ? "Company-wide schedule. Open a job to plan that site."
              : canEdit
                ? "Add phases, dates, and crew for this job."
                : "What’s planned on this job."}
          </p>
        </div>
        {canEdit && schemaReady ? (
          <Button type="button" className="min-h-11" onClick={openNew}>
            Add task
          </Button>
        ) : null}
      </header>

      {!schemaReady ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Run{" "}
          <code className="rounded bg-muted px-1 text-xs">
            supabase/migrations/0004_schedule_timeclock_messages_estimates.sql
          </code>{" "}
          in the Supabase SQL Editor to enable scheduling.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[12rem] flex-1 space-y-1.5 sm:max-w-xs">
          <Label htmlFor="schedule-job">Job</Label>
          <select
            id="schedule-job"
            className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
          >
            <option value="all">All jobs</option>
            {jobs
              .filter((j) => j.is_active || j.id === jobFilter)
              .map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 min-h-11 min-w-11"
            aria-label="Previous week"
            onClick={() => setAnchor((d) => addDays(d, -7))}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setAnchor(startOfWeekMonday(new Date()))}
          >
            This week
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 min-h-11 min-w-11"
            aria-label="Next week"
            onClick={() => setAnchor((d) => addDays(d, 7))}
          >
            <ChevronRight className="size-5" />
          </Button>
          <p className="text-sm font-medium">
            {formatShort(rangeStart)} – {formatShort(rangeEnd)}
          </p>
        </div>
      </div>

      {formOpen && canEdit ? (
        <form
          onSubmit={saveTask}
          className="space-y-4 rounded-lg border border-border p-4"
        >
          <h2 className="font-heading text-xl">
            {editingId ? "Edit task" : "New task"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                className="min-h-11"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-job">Job site</Label>
              <select
                id="task-job"
                className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={form.jobId}
                onChange={(e) => setForm({ ...form, jobId: e.target.value })}
              >
                <option value="">Unassigned</option>
                {jobs
                  .filter((j) => j.is_active || j.id === form.jobId)
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-status">Status</Label>
              <select
                id="task-status"
                className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ScheduleStatus })
                }
              >
                {SCHEDULE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-start">Start</Label>
              <Input
                id="task-start"
                type="date"
                className="min-h-11"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-end">End</Label>
              <Input
                id="task-end"
                type="date"
                className="min-h-11"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="task-notes">Notes</Label>
              <Textarea
                id="task-notes"
                className="min-h-20"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Assign crew</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {staff.map((p) => {
                const checked = form.assigneeIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="size-5 accent-yellow-400"
                      checked={checked}
                      onChange={() => toggleAssignee(p.id)}
                    />
                    <span className="text-sm">
                      {p.full_name?.trim() || "Team member"}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={saving}>
              {saving ? "Saving…" : "Save task"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="destructive"
                className="min-h-11"
                onClick={() => void deleteTask()}
                disabled={saving}
              >
                Delete
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading schedule…</p>
      ) : isAllJobs ? (
        <>
          <section className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="font-heading text-xl">Job sites</h2>
              <Input
                className="min-h-11 sm:max-w-xs"
                placeholder="Find a job"
                value={jobQuery}
                onChange={(e) => setJobQuery(e.target.value)}
                aria-label="Find a job"
              />
            </div>
            {jobSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No matching jobs. Add jobs in Admin, then open a site here.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {jobSummaries.map(({ job, count, blocked }) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setJobFilter(job.id)}
                    className="min-h-11 text-left"
                  >
                    <Card className="h-full transition-colors hover:bg-muted/50">
                      <CardHeader>
                        <CardTitle className="font-heading text-lg">
                          {job.name}
                        </CardTitle>
                        <CardDescription>
                          {count === 0
                            ? "No tasks this period"
                            : `${count} task${count === 1 ? "" : "s"} this period`}
                          {blocked > 0 ? ` · ${blocked} blocked` : ""}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <h2 className="font-heading text-xl">This period</h2>
            {groupedForAll.filter((g) => g.tasks.length > 0).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tasks in this date range.
              </p>
            ) : (
              groupedForAll
                .filter((g) => g.tasks.length > 0)
                .map((group) => (
                  <div key={group.id} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-heading text-lg">{group.name}</h3>
                      {group.id !== "none" ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => setJobFilter(group.id)}
                        >
                          Open job
                        </Button>
                      ) : null}
                    </div>
                    <ScheduleTimeline
                      tasks={group.tasks}
                      days={days}
                      rangeStart={rangeStart}
                      rangeEnd={rangeEnd}
                      todayIso={todayIso}
                      canEdit={canEdit}
                      showJobName={false}
                      nameFor={nameFor}
                      onSelect={openEdit}
                    />
                  </div>
                ))
            )}
          </section>
        </>
      ) : (
        <ScheduleTimeline
          tasks={visibleTasks}
          days={days}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          todayIso={todayIso}
          canEdit={canEdit}
          showJobName={false}
          nameFor={nameFor}
          onSelect={openEdit}
        />
      )}
    </main>
  );
}
