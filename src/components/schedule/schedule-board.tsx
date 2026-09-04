"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ScheduleLookahead } from "@/components/schedule/schedule-lookahead";
import { ScheduleTemplatesPanel } from "@/components/schedule/schedule-templates-panel";
import { ScheduleTimeline } from "@/components/schedule/schedule-timeline";
import { PageTrail } from "@/components/layout/page-breadcrumbs";
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
import {
  cascadeFinishToStart,
  wouldCreateCycle,
  type DepEdge,
} from "@/lib/schedule/dependencies";
import {
  addDays,
  formatShort,
  overlaps,
  startOfWeekMonday,
  toISODate,
} from "@/lib/schedule/dates";
import { placeTemplateItems } from "@/lib/schedule/templates";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/types/logs";
import {
  SCHEDULE_STATUSES,
  SCHEDULE_ZOOM_DAYS,
  statusLabel,
  type ScheduleDependency,
  type ScheduleStaff,
  type ScheduleStatus,
  type ScheduleTask,
  type ScheduleTemplate,
  type ScheduleTemplateItem,
  type ScheduleZoomDays,
} from "@/types/schedule";

const emptyForm = {
  title: "",
  jobId: "",
  start: toISODate(new Date()),
  end: toISODate(new Date()),
  status: "planned" as ScheduleStatus,
  notes: "",
  assigneeIds: [] as string[],
  predecessorIds: [] as string[],
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
  const fromJob = searchParams.get("from") === "job";

  const [anchor, setAnchor] = useState(() => startOfWeekMonday(new Date()));
  const [zoomDays, setZoomDays] = useState<ScheduleZoomDays>(14);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [allTasks, setAllTasks] = useState<ScheduleTask[]>([]);
  const [deps, setDeps] = useState<ScheduleDependency[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [staff, setStaff] = useState<ScheduleStaff[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [templateItems, setTemplateItems] = useState<ScheduleTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [depsSchemaReady, setDepsSchemaReady] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [jobQuery, setJobQuery] = useState("");

  const rangeStart = toISODate(anchor);
  const rangeEnd = toISODate(addDays(anchor, zoomDays - 1));
  const days = useMemo(
    () =>
      Array.from({ length: zoomDays }, (_, i) =>
        toISODate(addDays(anchor, i))
      ),
    [anchor, zoomDays]
  );
  const todayIso = toISODate(new Date());
  const selectedJob = jobs.find((j) => j.id === jobFilter) ?? null;
  const isAllJobs = jobFilter === "all";
  const lookaheadEnd = toISODate(addDays(new Date(), zoomDays - 1));

  const setJobFilter = useCallback(
    (id: string) => {
      if (fromJob && id === "all") {
        router.push("/jobs");
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (id === "all") {
        params.delete("job");
        params.delete("from");
      } else {
        params.set("job", id);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [fromJob, pathname, router, searchParams]
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const start = toISODate(anchor);
    const end = toISODate(addDays(anchor, zoomDays - 1));
    const lookStart = toISODate(addDays(new Date(), -14));
    const lookEnd = toISODate(addDays(new Date(), 30));

    const taskCols =
      "id, job_id, title, notes, start_date, end_date, status, jobs(name)";

    const [
      tasksRes,
      rangeTasksRes,
      assignRes,
      jobsRes,
      staffRes,
      depsRes,
      templatesRes,
      templateItemsRes,
    ] = await Promise.all([
      supabase
        .from("schedule_tasks")
        .select(taskCols)
        .lte("start_date", lookEnd)
        .gte("end_date", lookStart)
        .order("start_date"),
      supabase
        .from("schedule_tasks")
        .select(taskCols)
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
      supabase
        .from("schedule_dependencies")
        .select("id, predecessor_id, successor_id, lag_days"),
      supabase
        .from("schedule_templates")
        .select("id, name, description")
        .order("name"),
      supabase
        .from("schedule_template_items")
        .select(
          "id, template_id, title, duration_days, lag_days, sort_order, notes"
        )
        .order("sort_order"),
    ]);

    if (tasksRes.error && isMissingRelation(tasksRes.error.message)) {
      setSchemaReady(false);
      setError(null);
      setLoading(false);
      return;
    }
    setSchemaReady(true);

    const missingExtras =
      (depsRes.error && isMissingRelation(depsRes.error.message)) ||
      (templatesRes.error && isMissingRelation(templatesRes.error.message));
    setDepsSchemaReady(!missingExtras);

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

    const depRows = (depsRes.data ?? []) as ScheduleDependency[];
    const predsBySucc = new Map<string, string[]>();
    for (const d of depRows) {
      const list = predsBySucc.get(d.successor_id) ?? [];
      list.push(d.predecessor_id);
      predsBySucc.set(d.successor_id, list);
    }

    function mapTask(row: {
      id: string;
      job_id: string | null;
      title: string;
      notes: string | null;
      start_date: string;
      end_date: string;
      status: string;
      jobs: { name: string } | { name: string }[] | null;
    }): ScheduleTask {
      return {
        id: row.id,
        job_id: row.job_id,
        title: row.title,
        notes: row.notes,
        start_date: row.start_date,
        end_date: row.end_date,
        status: row.status as ScheduleStatus,
        sort_order: 0,
        jobName: jobNameFromJoin(row.jobs),
        assigneeIds: assigneesByTask.get(row.id) ?? [],
        predecessorIds: predsBySucc.get(row.id) ?? [],
      };
    }

    setAllTasks((tasksRes.data ?? []).map(mapTask));
    setTasks((rangeTasksRes.data ?? tasksRes.data ?? []).map(mapTask));
    setDeps(missingExtras ? [] : depRows);
    setJobs((jobsRes.data as Job[]) ?? []);
    setStaff(
      (staffRes.data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
      }))
    );
    setTemplates(
      missingExtras ? [] : ((templatesRes.data as ScheduleTemplate[]) ?? [])
    );
    setTemplateItems(
      missingExtras
        ? []
        : ((templateItemsRes.data as ScheduleTemplateItem[]) ?? [])
    );
    setError(
      assignRes.error?.message ||
        jobsRes.error?.message ||
        staffRes.error?.message ||
        (depsRes.error && !isMissingRelation(depsRes.error.message)
          ? depsRes.error.message
          : null) ||
        null
    );
    setLoading(false);
  }, [anchor, zoomDays]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const itemsByTemplate = useMemo(() => {
    const map = new Map<string, ScheduleTemplateItem[]>();
    for (const item of templateItems) {
      const list = map.get(item.template_id) ?? [];
      list.push(item);
      map.set(item.template_id, list);
    }
    return map;
  }, [templateItems]);

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

  const lookaheadTasks = useMemo(() => {
    const base = isAllJobs
      ? allTasks
      : allTasks.filter((t) => t.job_id === jobFilter);
    return base.filter(
      (t) =>
        overlaps(t.start_date, t.end_date, toISODate(addDays(new Date(), -30)), lookaheadEnd) ||
        (t.end_date < todayIso && t.status !== "done")
    );
  }, [allTasks, isAllJobs, jobFilter, lookaheadEnd, todayIso]);

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

  const predecessorCandidates = useMemo(() => {
    if (!editingId && !form.jobId) {
      return allTasks.filter((t) => !form.jobId || t.job_id === form.jobId);
    }
    const jobId = form.jobId || null;
    return allTasks.filter(
      (t) =>
        t.id !== editingId &&
        (jobId ? t.job_id === jobId : true)
    );
  }, [allTasks, editingId, form.jobId]);

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
      predecessorIds: [...task.predecessorIds],
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

  function togglePredecessor(id: string) {
    setForm((prev) => ({
      ...prev,
      predecessorIds: prev.predecessorIds.includes(id)
        ? prev.predecessorIds.filter((x) => x !== id)
        : [...prev.predecessorIds, id],
    }));
  }

  function nameFor(id: string) {
    return staff.find((s) => s.id === id)?.full_name?.trim() || "Team member";
  }

  async function persistCascadedDates(
    updates: Map<string, { start_date: string; end_date: string }>
  ) {
    const supabase = createClient();
    if (!supabase) return;
    for (const [id, dates] of updates) {
      const { error: updError } = await supabase
        .from("schedule_tasks")
        .update(dates)
        .eq("id", id);
      if (updError) throw new Error(updError.message);
    }
  }

  async function handleDatesChange(
    task: ScheduleTask,
    start: string,
    end: string
  ) {
    if (end < start) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    try {
      const edges: DepEdge[] = deps.map((d) => ({
        predecessor_id: d.predecessor_id,
        successor_id: d.successor_id,
        lag_days: d.lag_days,
      }));
      const updates = cascadeFinishToStart(
        allTasks.map((t) => ({
          id: t.id,
          start_date: t.start_date,
          end_date: t.end_date,
        })),
        edges,
        task.id,
        start,
        end
      );
      await persistCascadedDates(updates);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update dates.");
    } finally {
      setSaving(false);
    }
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

    if (depsSchemaReady && editingId) {
      const edges: DepEdge[] = deps
        .filter((d) => d.successor_id !== editingId)
        .map((d) => ({
          predecessor_id: d.predecessor_id,
          successor_id: d.successor_id,
          lag_days: d.lag_days,
        }));
      for (const predId of form.predecessorIds) {
        if (wouldCreateCycle(edges, predId, editingId)) {
          setError("That predecessor would create a circular dependency.");
          return;
        }
        edges.push({
          predecessor_id: predId,
          successor_id: editingId,
          lag_days: 0,
        });
      }
    }

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

      if (depsSchemaReady) {
        await supabase
          .from("schedule_dependencies")
          .delete()
          .eq("successor_id", taskId);
        if (form.predecessorIds.length) {
          const { error: depError } = await supabase
            .from("schedule_dependencies")
            .insert(
              form.predecessorIds.map((predecessor_id) => ({
                predecessor_id,
                successor_id: taskId,
                lag_days: 0,
              }))
            );
          if (depError) {
            setSaving(false);
            setError(depError.message);
            return;
          }
        }

        const edges: DepEdge[] = [
          ...deps
            .filter((d) => d.successor_id !== taskId)
            .map((d) => ({
              predecessor_id: d.predecessor_id,
              successor_id: d.successor_id,
              lag_days: d.lag_days,
            })),
          ...form.predecessorIds.map((predecessor_id) => ({
            predecessor_id,
            successor_id: taskId!,
            lag_days: 0,
          })),
        ];
        const updates = cascadeFinishToStart(
          allTasks
            .filter((t) => t.id !== taskId)
            .map((t) => ({
              id: t.id,
              start_date: t.start_date,
              end_date: t.end_date,
            }))
            .concat([
              {
                id: taskId,
                start_date: form.start,
                end_date: form.end,
              },
            ]),
          edges,
          taskId,
          form.start,
          form.end
        );
        try {
          await persistCascadedDates(updates);
        } catch (err) {
          setSaving(false);
          setError(
            err instanceof Error ? err.message : "Could not cascade dates."
          );
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

  async function saveTemplate(payload: {
    id?: string;
    name: string;
    description: string;
    items: {
      title: string;
      duration_days: number;
      lag_days: number;
      sort_order: number;
      notes: string | null;
    }[];
  }) {
    const supabase = createClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let templateId = payload.id;
    if (templateId) {
      const { error: updError } = await supabase
        .from("schedule_templates")
        .update({
          name: payload.name,
          description: payload.description || null,
        })
        .eq("id", templateId);
      if (updError) throw new Error(updError.message);
      await supabase
        .from("schedule_template_items")
        .delete()
        .eq("template_id", templateId);
    } else {
      const { data, error: insError } = await supabase
        .from("schedule_templates")
        .insert({
          name: payload.name,
          description: payload.description || null,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (insError || !data) throw new Error(insError?.message ?? "Insert failed");
      templateId = data.id;
    }

    const { error: itemsError } = await supabase
      .from("schedule_template_items")
      .insert(
        payload.items.map((it) => ({
          template_id: templateId,
          title: it.title,
          duration_days: it.duration_days,
          lag_days: it.lag_days,
          sort_order: it.sort_order,
          notes: it.notes,
        }))
      );
    if (itemsError) throw new Error(itemsError.message);
    await load();
  }

  async function deleteTemplate(id: string) {
    const supabase = createClient();
    if (!supabase) return;
    const { error: delError } = await supabase
      .from("schedule_templates")
      .delete()
      .eq("id", id);
    if (delError) setError(delError.message);
    else await load();
  }

  async function applyTemplate(templateId: string, startDate: string) {
    if (!selectedJob) throw new Error("Open a job first.");
    const supabase = createClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const items = itemsByTemplate.get(templateId) ?? [];
    if (!items.length) throw new Error("Template has no phases.");

    const placed = placeTemplateItems(
      startDate,
      items.map((it) => ({
        title: it.title,
        duration_days: it.duration_days,
        lag_days: it.lag_days,
        sort_order: it.sort_order,
        notes: it.notes,
      }))
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: created, error: insError } = await supabase
      .from("schedule_tasks")
      .insert(
        placed.map((p) => ({
          job_id: selectedJob.id,
          title: p.title,
          notes: p.notes,
          start_date: p.start_date,
          end_date: p.end_date,
          status: "planned",
          sort_order: p.sort_order,
          created_by: user?.id ?? null,
        }))
      )
      .select("id, sort_order")
      .order("sort_order");

    if (insError || !created?.length) {
      throw new Error(insError?.message ?? "Could not create tasks.");
    }

    if (depsSchemaReady && created.length > 1) {
      const ordered = [...created].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      const edges = ordered.slice(1).map((row, i) => ({
        predecessor_id: ordered[i].id,
        successor_id: row.id,
        lag_days: items[i + 1]?.lag_days ?? 0,
      }));
      const { error: depError } = await supabase
        .from("schedule_dependencies")
        .insert(edges);
      if (depError) throw new Error(depError.message);
    }

    await load();
  }

  const heading = isAllJobs
    ? "All jobs"
    : selectedJob?.name ?? "Job schedule";

  const stepDays = zoomDays === 7 ? 7 : zoomDays === 21 ? 7 : 7;

  const crumbs = isAllJobs
    ? [{ label: "Schedule" }]
    : fromJob
      ? [
          { label: "Jobs", href: "/jobs" },
          {
            label: selectedJob?.name ?? "Job",
            href: `/jobs/${jobFilter}`,
          },
          { label: "Schedule" },
        ]
      : [
          { label: "Schedule", href: "/schedule" },
          { label: selectedJob?.name ?? "Job" },
        ];

  const trailFallback = fromJob && !isAllJobs
    ? `/jobs/${jobFilter}`
    : isAllJobs
      ? "/dashboard"
      : "/schedule";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageTrail items={crumbs} fallbackHref={trailFallback} />
          <h1 className="font-heading text-3xl md:text-4xl">{heading}</h1>
          <p className="mt-1 text-muted-foreground">
            {isAllJobs
              ? "Company-wide schedule. Open a job to plan that site."
              : canEdit
                ? "Plan phases, drag the Gantt, link dependencies, apply templates."
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

      {schemaReady && !depsSchemaReady ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          For dependencies and templates, also run{" "}
          <code className="rounded bg-muted px-1 text-xs">
            supabase/migrations/0009_schedule_gantt_deps_templates.sql
          </code>
          .
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
        <div className="space-y-1.5">
          <Label htmlFor="schedule-zoom">Zoom</Label>
          <select
            id="schedule-zoom"
            className="flex min-h-11 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={zoomDays}
            onChange={(e) =>
              setZoomDays(Number(e.target.value) as ScheduleZoomDays)
            }
          >
            {SCHEDULE_ZOOM_DAYS.map((d) => (
              <option key={d} value={d}>
                {d === 7
                  ? "1 week"
                  : d === 14
                    ? "2 weeks"
                    : d === 21
                      ? "3 weeks"
                      : "1 month"}
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
            aria-label="Previous period"
            onClick={() => setAnchor((d) => addDays(d, -stepDays))}
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
            aria-label="Next period"
            onClick={() => setAnchor((d) => addDays(d, stepDays))}
          >
            <ChevronRight className="size-5" />
          </Button>
          <p className="text-sm font-medium">
            {formatShort(rangeStart)} – {formatShort(rangeEnd)}
          </p>
        </div>
      </div>

      {schemaReady ? (
        <ScheduleLookahead
          tasks={lookaheadTasks}
          todayIso={todayIso}
          horizonEnd={lookaheadEnd}
          onSelect={openEdit}
          canEdit={canEdit}
        />
      ) : null}

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
          {depsSchemaReady ? (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">
                Depends on (finish before this starts)
              </legend>
              {predecessorCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No other tasks available as predecessors.
                </p>
              ) : (
                <div className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
                  {predecessorCandidates.map((t) => {
                    const checked = form.predecessorIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          className="size-5 accent-yellow-400"
                          checked={checked}
                          onChange={() => togglePredecessor(t.id)}
                        />
                        <span className="text-sm">
                          {t.title}
                          <span className="text-muted-foreground">
                            {" "}
                            · {formatShort(t.end_date)}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ) : null}
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
                      onDatesChange={canEdit ? handleDatesChange : undefined}
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
          onDatesChange={canEdit ? handleDatesChange : undefined}
        />
      )}

      {schemaReady && depsSchemaReady ? (
        <ScheduleTemplatesPanel
          templates={templates}
          itemsByTemplate={itemsByTemplate}
          jobId={isAllJobs ? null : jobFilter}
          jobName={selectedJob?.name ?? null}
          canEdit={canEdit}
          onSaveTemplate={saveTemplate}
          onDeleteTemplate={deleteTemplate}
          onApplyTemplate={applyTemplate}
        />
      ) : null}
    </main>
  );
}
