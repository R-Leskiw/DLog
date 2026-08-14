"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/types/logs";
import {
  defaultShiftLocals,
  fromLocalInput,
  paidHours,
  breakHours,
  formatDuration,
  formatDurationLabel,
  hoursBetween,
  toLocalInput,
  type TimeBreak,
  type TimeEntry,
} from "@/types/timeclock";

type StaffOption = { id: string; full_name: string | null };

type BreakDraft = { key: string; start: string; end: string };

function draftsFromBreaks(breaks: TimeBreak[]): BreakDraft[] {
  return breaks
    .filter((b) => b.ended_at)
    .map((b, i) => ({
      key: b.id ?? `b-${i}`,
      start: toLocalInput(b.started_at),
      end: toLocalInput(b.ended_at!),
    }));
}

export function ShiftEditor({
  isAdmin,
  currentUserId,
  jobs,
  staff,
  entry,
  breaksEnabled,
  onCancel,
  onSaved,
}: {
  isAdmin: boolean;
  currentUserId: string;
  jobs: Job[];
  staff: StaffOption[];
  entry: TimeEntry | null;
  breaksEnabled: boolean;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const defaults = defaultShiftLocals();
  const [userId, setUserId] = useState(entry?.user_id ?? currentUserId);
  const [jobId, setJobId] = useState(entry?.job_id ?? "");
  const [clockIn, setClockIn] = useState(
    entry ? toLocalInput(entry.clock_in) : defaults.clockIn
  );
  const [clockOut, setClockOut] = useState(
    entry?.clock_out ? toLocalInput(entry.clock_out) : defaults.clockOut
  );
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [breaks, setBreaks] = useState<BreakDraft[]>(
    entry ? draftsFromBreaks(entry.breaks) : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breakDrafts = breaks.map((b) => ({
    started_at: b.start ? fromLocalInput(b.start) : "",
    ended_at: b.end ? fromLocalInput(b.end) : null,
  }));
  const previewBreakHours = (() => {
    try {
      return breakHours(
        breakDrafts.filter((b) => b.started_at && b.ended_at) as TimeBreak[]
      );
    } catch {
      return 0;
    }
  })();
  const previewHours = (() => {
    try {
      return paidHours(
        fromLocalInput(clockIn),
        fromLocalInput(clockOut),
        breakDrafts.filter((b) => b.started_at && b.ended_at) as TimeBreak[]
      );
    } catch {
      return 0;
    }
  })();

  function addBreakRow() {
    setBreaks((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        start: clockIn,
        end: clockIn,
      },
    ]);
  }

  function durationFor(b: BreakDraft) {
    if (!b.start || !b.end) return 0;
    try {
      return hoursBetween(fromLocalInput(b.start), fromLocalInput(b.end));
    } catch {
      return 0;
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!jobId) {
      setError("Choose a job site.");
      return;
    }
    const inIso = fromLocalInput(clockIn);
    const outIso = fromLocalInput(clockOut);
    if (outIso <= inIso) {
      setError("Clock out must be after clock in.");
      return;
    }
    for (const b of breaks) {
      const bs = fromLocalInput(b.start);
      const be = fromLocalInput(b.end);
      if (be <= bs) {
        setError("Each break must end after it starts.");
        return;
      }
      if (bs < inIso || be > outIso) {
        setError("Breaks must fall inside the shift.");
        return;
      }
    }

    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);

    const payload = {
      user_id: isAdmin ? userId : currentUserId,
      job_id: jobId,
      clock_in: inIso,
      clock_out: outIso,
      notes: notes.trim() || null,
    };

    let entryId = entry?.id;
    if (entryId) {
      const { error: updateError } = await supabase
        .from("time_entries")
        .update(payload)
        .eq("id", entryId);
      if (updateError) {
        setSaving(false);
        setError(updateError.message);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("time_entries")
        .insert(payload)
        .select("id")
        .single();
      if (insertError || !data) {
        setSaving(false);
        setError(insertError?.message ?? "Could not save shift.");
        return;
      }
      entryId = data.id;
    }

    if (breaksEnabled && entryId) {
      const { error: delError } = await supabase
        .from("time_entry_breaks")
        .delete()
        .eq("time_entry_id", entryId);
      if (delError) {
        setSaving(false);
        setError(delError.message);
        return;
      }
      if (breaks.length) {
        const { error: brError } = await supabase.from("time_entry_breaks").insert(
          breaks.map((b) => ({
            time_entry_id: entryId,
            started_at: fromLocalInput(b.start),
            ended_at: fromLocalInput(b.end),
          }))
        );
        if (brError) {
          setSaving(false);
          setError(brError.message);
          return;
        }
      }
    }

    setSaving(false);
    await onSaved();
  }

  async function removeShift() {
    if (!entry) return;
    if (!window.confirm("Delete this shift?")) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    const { error: delError } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", entry.id);
    setSaving(false);
    if (delError) {
      setError(delError.message);
      return;
    }
    await onSaved();
  }

  return (
    <form
      onSubmit={save}
      className="space-y-4 rounded-xl border border-border p-4"
    >
      <h2 className="font-heading text-xl">
        {entry ? "Edit shift" : "Add shift"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Break total: {formatDurationLabel(previewBreakHours)} · Paid time:{" "}
        {formatDurationLabel(previewHours)} ({formatDuration(previewHours)})
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {isAdmin ? (
        <div className="space-y-1.5">
          <Label htmlFor="shift-user">Employee</Label>
          <select
            id="shift-user"
            className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={Boolean(entry)}
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name?.trim() || "Team member"}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="shift-job">Job site</Label>
        <select
          id="shift-job"
          className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          required
        >
          <option value="">Select a job</option>
          {jobs
            .filter((j) => j.is_active || j.id === jobId)
            .map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="shift-in">Clock in</Label>
          <Input
            id="shift-in"
            type="datetime-local"
            className="min-h-11"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="shift-out">Clock out</Label>
          <Input
            id="shift-out"
            type="datetime-local"
            className="min-h-11"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="shift-notes">Note (optional)</Label>
        <Textarea
          id="shift-notes"
          className="min-h-16"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {breaksEnabled ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Breaks</legend>
          <p className="text-sm text-muted-foreground">
            Set a start and end time for each break. Any length is allowed.
          </p>
          {breaks.map((b, index) => {
            const dur = durationFor(b);
            return (
              <div
                key={b.key}
                className="space-y-2 rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Break {index + 1}</p>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {formatDurationLabel(dur)}
                    {dur > 0 ? ` (${formatDuration(dur)})` : ""}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`break-start-${b.key}`}>
                      Break start
                    </Label>
                    <Input
                      id={`break-start-${b.key}`}
                      type="datetime-local"
                      className="min-h-11"
                      value={b.start}
                      onChange={(e) =>
                        setBreaks((prev) =>
                          prev.map((x) =>
                            x.key === b.key ? { ...x, start: e.target.value } : x
                          )
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`break-end-${b.key}`}>Break end</Label>
                    <Input
                      id={`break-end-${b.key}`}
                      type="datetime-local"
                      className="min-h-11"
                      value={b.end}
                      onChange={(e) =>
                        setBreaks((prev) =>
                          prev.map((x) =>
                            x.key === b.key ? { ...x, end: e.target.value } : x
                          )
                        )
                      }
                      required
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={() =>
                    setBreaks((prev) => prev.filter((x) => x.key !== b.key))
                  }
                >
                  Remove break
                </Button>
              </div>
            );
          })}
          <p className="font-medium">
            Total break time: {formatDurationLabel(previewBreakHours)}
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={addBreakRow}
          >
            Add break
          </Button>
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">
          Run{" "}
          <code className="rounded bg-muted px-1 text-xs">
            supabase/migrations/0005_timeclock_breaks.sql
          </code>{" "}
          to enable breaks.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11" disabled={saving}>
          {saving ? "Saving…" : "Save shift"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onCancel}
        >
          Cancel
        </Button>
        {entry ? (
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            onClick={() => void removeShift()}
            disabled={saving}
          >
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}
