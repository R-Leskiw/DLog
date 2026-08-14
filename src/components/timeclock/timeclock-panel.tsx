"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ShiftEditor } from "@/components/timeclock/shift-editor";
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
import { startOfWeekMonday, toISODate } from "@/lib/schedule/dates";
import type { Job } from "@/types/logs";
import {
  breakHours,
  formatDuration,
  formatDurationLabel,
  formatPunchTime,
  fromLocalInput,
  hoursBetween,
  paidHours,
  toLocalInput,
  type HoursRow,
  type TimeBreak,
  type TimeEntry,
} from "@/types/timeclock";

function isMissingRelation(message: string | undefined) {
  if (!message) return false;
  return /does not exist|schema cache/i.test(message);
}

function jobName(
  jobs: { name: string } | { name: string }[] | null | undefined
) {
  if (!jobs) return null;
  return Array.isArray(jobs) ? jobs[0]?.name ?? null : jobs.name;
}

function mapEntry(
  row: {
    id: string;
    user_id: string;
    job_id: string;
    clock_in: string;
    clock_out: string | null;
    notes: string | null;
    jobs?: { name: string } | { name: string }[] | null;
  },
  breaks: TimeBreak[]
): TimeEntry {
  return {
    id: row.id,
    user_id: row.user_id,
    job_id: row.job_id,
    clock_in: row.clock_in,
    clock_out: row.clock_out,
    notes: row.notes,
    jobName: jobName(row.jobs),
    breaks,
  };
}

export function TimeclockPanel({ isAdmin }: { isAdmin: boolean }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [staff, setStaff] = useState<{ id: string; full_name: string | null }[]>(
    []
  );
  const [openEntry, setOpenEntry] = useState<TimeEntry | null>(null);
  const [recent, setRecent] = useState<TimeEntry[]>([]);
  const [jobId, setJobId] = useState("");
  const [notes, setNotes] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [breaksEnabled, setBreaksEnabled] = useState(true);
  const [editor, setEditor] = useState<"new" | TimeEntry | null>(null);
  const [liveBreakStart, setLiveBreakStart] = useState("");
  const [liveBreakEnd, setLiveBreakEnd] = useState("");

  const [periodStart, setPeriodStart] = useState(() =>
    toISODate(startOfWeekMonday(new Date()))
  );
  const [periodEnd, setPeriodEnd] = useState(() => toISODate(new Date()));
  const [report, setReport] = useState<HoursRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  const attachBreaks = useCallback(
    async (
      supabase: NonNullable<ReturnType<typeof createClient>>,
      entries: Parameters<typeof mapEntry>[0][]
    ) => {
      if (!entries.length) return { mapped: [] as TimeEntry[], enabled: true };
      const ids = entries.map((e) => e.id);
      const { data, error: brError } = await supabase
        .from("time_entry_breaks")
        .select("id, time_entry_id, started_at, ended_at")
        .in("time_entry_id", ids);
      if (brError && isMissingRelation(brError.message)) {
        return {
          mapped: entries.map((e) => mapEntry(e, [])),
          enabled: false,
        };
      }
      if (brError) {
        return {
          mapped: entries.map((e) => mapEntry(e, [])),
          enabled: true,
        };
      }
      const byEntry = new Map<string, TimeBreak[]>();
      for (const b of data ?? []) {
        const list = byEntry.get(b.time_entry_id) ?? [];
        list.push({
          id: b.id,
          time_entry_id: b.time_entry_id,
          started_at: b.started_at,
          ended_at: b.ended_at,
        });
        byEntry.set(b.time_entry_id, list);
      }
      return {
        mapped: entries.map((e) => mapEntry(e, byEntry.get(e.id) ?? [])),
        enabled: true,
      };
    },
    []
  );

  const loadMine = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const [jobsRes, openRes, recentRes, staffRes] = await Promise.all([
      supabase.from("jobs").select("id, name, is_active").order("name"),
      supabase
        .from("time_entries")
        .select("id, user_id, job_id, clock_in, clock_out, notes, jobs(name)")
        .eq("user_id", user.id)
        .is("clock_out", null)
        .maybeSingle(),
      supabase
        .from("time_entries")
        .select("id, user_id, job_id, clock_in, clock_out, notes, jobs(name)")
        .eq("user_id", user.id)
        .order("clock_in", { ascending: false })
        .limit(12),
      isAdmin
        ? supabase
            .from("profiles")
            .select("id, full_name, role, approval_status")
            .eq("approval_status", "approved")
            .in("role", ["employee", "admin"])
            .order("full_name")
        : Promise.resolve({ data: [], error: null }),
    ]);

    const missing = [jobsRes.error, openRes.error, recentRes.error].find(
      (e) => e && isMissingRelation(e.message)
    );
    if (missing) {
      setSchemaReady(false);
      setError(null);
      setLoading(false);
      return;
    }
    setSchemaReady(true);

    if (openRes.error && !/multiple/i.test(openRes.error.message)) {
      setError(openRes.error.message);
    } else {
      setError(jobsRes.error?.message || recentRes.error?.message || null);
    }

    const rows = [
      ...(openRes.data ? [openRes.data] : []),
      ...((recentRes.data ?? []) as typeof openRes.data[]),
    ].filter(Boolean) as Parameters<typeof mapEntry>[0][];
    const unique = new Map(rows.map((r) => [r.id, r]));
    const { mapped, enabled } = await attachBreaks(supabase, [...unique.values()]);
    setBreaksEnabled(enabled);

    const byId = new Map(mapped.map((e) => [e.id, e]));
    setJobs((jobsRes.data as Job[]) ?? []);
    setStaff(
      (staffRes.data ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
      }))
    );
    setOpenEntry(openRes.data ? byId.get(openRes.data.id) ?? null : null);
    setRecent((recentRes.data ?? []).map((r) => byId.get(r.id)!).filter(Boolean));
    setLoading(false);
  }, [attachBreaks, isAdmin]);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  useEffect(() => {
    if (!openEntry) return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [openEntry]);

  const loadReport = useCallback(async () => {
    if (!isAdmin) return;
    const supabase = createClient();
    if (!supabase) return;
    setReportLoading(true);
    const from = new Date(`${periodStart}T00:00:00`).toISOString();
    const to = new Date(`${periodEnd}T23:59:59.999`).toISOString();

    const { data, error: loadError } = await supabase
      .from("time_entries")
      .select("id, user_id, job_id, clock_in, clock_out, notes, jobs(name)")
      .gte("clock_in", from)
      .lte("clock_in", to)
      .order("clock_in");

    if (loadError) {
      setError(loadError.message);
      setReportLoading(false);
      return;
    }

    const { mapped } = await attachBreaks(supabase, data ?? []);
    const userIds = [...new Set(mapped.map((e) => e.user_id))];
    const nameById = new Map<string, string>();
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        nameById.set(p.id, p.full_name?.trim() || "Team member");
      }
    }

    const byUser = new Map<string, HoursRow>();
    for (const entry of mapped) {
      const row = byUser.get(entry.user_id) ?? {
        userId: entry.user_id,
        name: nameById.get(entry.user_id) ?? "Team member",
        hours: 0,
        openPunch: false,
        onBreak: false,
        byJob: [],
      };
      if (!entry.clock_out) {
        row.openPunch = true;
        if (entry.breaks.some((b) => !b.ended_at)) row.onBreak = true;
      } else {
        const h = paidHours(entry.clock_in, entry.clock_out, entry.breaks);
        row.hours += h;
        const jobLabel = entry.jobName || "Unknown job";
        const existing = row.byJob.find((j) => j.jobName === jobLabel);
        if (existing) existing.hours += h;
        else row.byJob.push({ jobName: jobLabel, hours: h });
      }
      byUser.set(entry.user_id, row);
    }

    setReport(
      [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name))
    );
    setReportLoading(false);
  }, [attachBreaks, isAdmin, periodStart, periodEnd]);

  useEffect(() => {
    if (isAdmin && schemaReady) void loadReport();
  }, [isAdmin, schemaReady, loadReport]);

  const openBreak = openEntry?.breaks.find((b) => !b.ended_at) ?? null;
  const elapsedPaid = openEntry
    ? paidHours(openEntry.clock_in, null, openEntry.breaks, now)
    : 0;
  const totalBreakHours = openEntry
    ? breakHours(openEntry.breaks, now)
    : 0;

  useEffect(() => {
    if (!openEntry) return;
    const stamp = toLocalInput(new Date().toISOString());
    if (openBreak) {
      setLiveBreakStart(toLocalInput(openBreak.started_at));
      setLiveBreakEnd(stamp);
    } else {
      setLiveBreakStart(stamp);
      setLiveBreakEnd(stamp);
    }
  }, [openEntry?.id, openBreak?.id]);

  const myClosedHours = useMemo(() => {
    return recent
      .filter((e) => e.clock_out)
      .reduce(
        (sum, e) => sum + paidHours(e.clock_in, e.clock_out, e.breaks),
        0
      );
  }, [recent]);

  async function clockIn(e: React.FormEvent) {
    e.preventDefault();
    if (!jobId) {
      setError("Choose a job site before clocking in.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("time_entries").insert({
      user_id: user.id,
      job_id: jobId,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNotes("");
    await loadMine();
  }

  async function startBreak() {
    if (!openEntry || !breaksEnabled || !liveBreakStart) return;
    const startIso = fromLocalInput(liveBreakStart);
    if (startIso < openEntry.clock_in) {
      setError("Break start must be after clock in.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("time_entry_breaks").insert({
      time_entry_id: openEntry.id,
      started_at: startIso,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await loadMine();
  }

  async function endBreak() {
    if (!openBreak?.id || !liveBreakEnd) return;
    const endIso = fromLocalInput(liveBreakEnd);
    if (endIso <= (openBreak.started_at || liveBreakStart)) {
      setError("Break end must be after break start.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("time_entry_breaks")
      .update({ ended_at: endIso })
      .eq("id", openBreak.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await loadMine();
  }

  async function logCompletedBreak() {
    if (!openEntry || !liveBreakStart || !liveBreakEnd) return;
    const startIso = fromLocalInput(liveBreakStart);
    const endIso = fromLocalInput(liveBreakEnd);
    if (endIso <= startIso) {
      setError("Break end must be after break start.");
      return;
    }
    if (startIso < openEntry.clock_in) {
      setError("Breaks must fall inside the shift.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("time_entry_breaks").insert({
      time_entry_id: openEntry.id,
      started_at: startIso,
      ended_at: endIso,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await loadMine();
  }

  async function clockOut() {
    if (!openEntry) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const stamp = new Date().toISOString();
    if (openBreak?.id) {
      const { error: brError } = await supabase
        .from("time_entry_breaks")
        .update({ ended_at: stamp })
        .eq("id", openBreak.id);
      if (brError) {
        setSaving(false);
        setError(brError.message);
        return;
      }
    }
    const { error: updateError } = await supabase
      .from("time_entries")
      .update({ clock_out: stamp })
      .eq("id", openEntry.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await loadMine();
    if (isAdmin) await loadReport();
  }

  async function afterSave() {
    setEditor(null);
    await loadMine();
    if (isAdmin) await loadReport();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl">Timeclock</h1>
          <p className="mt-1 text-muted-foreground">
            Clock in on site, take a break, or add a missed shift.
          </p>
        </div>
        {schemaReady && userId ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setEditor("new")}
          >
            Add shift
          </Button>
        ) : null}
      </header>

      {!schemaReady ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Run{" "}
          <code className="rounded bg-muted px-1 text-xs">
            supabase/migrations/0004_schedule_timeclock_messages_estimates.sql
          </code>{" "}
          in the Supabase SQL Editor to enable timeclock.
        </p>
      ) : null}

      {schemaReady && !breaksEnabled ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Run{" "}
          <code className="rounded bg-muted px-1 text-xs">
            supabase/migrations/0005_timeclock_breaks.sql
          </code>{" "}
          to enable breaks and missed-shift edits.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {editor && userId ? (
        <ShiftEditor
          isAdmin={isAdmin}
          currentUserId={userId}
          jobs={jobs}
          staff={
            staff.length
              ? staff
              : [{ id: userId, full_name: "You" }]
          }
          entry={editor === "new" ? null : editor}
          breaksEnabled={breaksEnabled}
          onCancel={() => setEditor(null)}
          onSaved={afterSave}
        />
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading timeclock…</p>
      ) : schemaReady && openEntry ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              {openBreak ? "You’re on break" : "You’re on the clock"}
            </CardTitle>
            <CardDescription>
              {openEntry.jobName || "Job site"} · started{" "}
              {formatPunchTime(openEntry.clock_in)}
            </CardDescription>
            <p className="font-heading text-4xl tabular-nums">
              {formatDuration(elapsedPaid)}
            </p>
            <p className="text-sm text-muted-foreground">
              Paid time · Break total {formatDurationLabel(totalBreakHours)}
              {totalBreakHours > 0 ? ` (${formatDuration(totalBreakHours)})` : ""}
            </p>
          </CardHeader>
          <div className="flex flex-col gap-3 px-4 pb-4">
            {breaksEnabled ? (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Break times</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="live-break-start">Break start</Label>
                    <Input
                      id="live-break-start"
                      type="datetime-local"
                      className="min-h-11"
                      value={liveBreakStart}
                      onChange={(e) => setLiveBreakStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="live-break-end">Break end</Label>
                    <Input
                      id="live-break-end"
                      type="datetime-local"
                      className="min-h-11"
                      value={liveBreakEnd}
                      onChange={(e) => setLiveBreakEnd(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-sm">
                  This break:{" "}
                  <span className="font-medium tabular-nums">
                    {liveBreakStart && liveBreakEnd
                      ? formatDurationLabel(
                          hoursBetween(
                            fromLocalInput(liveBreakStart),
                            fromLocalInput(liveBreakEnd)
                          )
                        )
                      : openBreak
                        ? formatDurationLabel(
                            hoursBetween(openBreak.started_at, null, now)
                          )
                        : "0 min"}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Total break time this shift:{" "}
                  {formatDurationLabel(totalBreakHours)}
                </p>
                {openBreak ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-14 w-full text-base"
                    onClick={() => void endBreak()}
                    disabled={saving}
                  >
                    {saving ? "Updating…" : "End break"}
                  </Button>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-14 text-base"
                      onClick={() => void startBreak()}
                      disabled={saving}
                    >
                      {saving ? "Updating…" : "Start break"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-14 text-base"
                      onClick={() => void logCompletedBreak()}
                      disabled={saving}
                    >
                      Save this break
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
            <Button
              type="button"
              className="min-h-14 w-full text-base"
              onClick={() => void clockOut()}
              disabled={saving}
            >
              {saving ? "Clocking out…" : "Clock out"}
            </Button>
          </div>
        </Card>
      ) : schemaReady ? (
        <form
          onSubmit={clockIn}
          className="space-y-4 rounded-xl border border-border p-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="clock-job">Job site</Label>
            <select
              id="clock-job"
              className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              required
            >
              <option value="">Select a job</option>
              {jobs
                .filter((j) => j.is_active)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clock-notes">Note (optional)</Label>
            <Textarea
              id="clock-notes"
              className="min-h-16"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Crew, weather, extra trip…"
            />
          </div>
          <Button
            type="submit"
            className="min-h-14 w-full text-base"
            disabled={saving}
          >
            {saving ? "Clocking in…" : "Clock in"}
          </Button>
        </form>
      ) : null}

      {schemaReady && recent.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-xl">Your recent punches</h2>
          <p className="text-sm text-muted-foreground">
            Paid time on this list: {formatDuration(myClosedHours)} hours
          </p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {recent.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{entry.jobName || "Job site"}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatPunchTime(entry.clock_in)}
                    {entry.clock_out
                      ? ` → ${formatPunchTime(entry.clock_out)} · paid ${formatDurationLabel(paidHours(entry.clock_in, entry.clock_out, entry.breaks))}`
                      : " · Open"}
                    {entry.breaks.length
                      ? ` · breaks ${formatDurationLabel(breakHours(entry.breaks))}`
                      : ""}
                  </p>
                </div>
                {entry.clock_out ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setEditor(entry)}
                  >
                    Edit
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isAdmin && schemaReady ? (
        <section className="space-y-4">
          <h2 className="font-heading text-xl">Hours by employee</h2>
          <p className="text-sm text-muted-foreground">
            Hours after breaks. Open clocks are flagged, not totaled.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="period-start">From</Label>
              <Input
                id="period-start"
                type="date"
                className="min-h-11"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-end">To</Label>
              <Input
                id="period-end"
                type="date"
                className="min-h-11"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                onClick={() => void loadReport()}
                disabled={reportLoading}
              >
                {reportLoading ? "Loading…" : "Refresh"}
              </Button>
            </div>
          </div>
          {report.length === 0 && !reportLoading ? (
            <p className="text-sm text-muted-foreground">
              No punches in this pay period.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {report.map((row) => (
                <li key={row.userId} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{row.name}</p>
                    <p className="font-heading text-lg tabular-nums">
                      {formatDuration(row.hours)}
                    </p>
                  </div>
                  {row.openPunch ? (
                    <p className="text-xs text-muted-foreground">
                      {row.onBreak
                        ? "On break (open punch not in total)"
                        : "Has an open punch (not in total)"}
                    </p>
                  ) : null}
                  {row.byJob.length ? (
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {row.byJob.map((j) => (
                        <li key={j.jobName}>
                          {j.jobName}: {formatDuration(j.hours)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
