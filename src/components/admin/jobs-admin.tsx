"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/types/logs";
import { cn } from "@/lib/utils";

export function JobsAdmin() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const { data, error: loadError } = await supabase
      .from("jobs")
      .select("id, name, is_active, created_at")
      .order("name");
    if (loadError) {
      setError(loadError.message);
    } else {
      setJobs((data as Job[]) ?? []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("jobs").insert({
      name: trimmed,
      is_active: true,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    await load();
  }

  async function renameJob(job: Job, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === job.name) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error: updateError } = await supabase
      .from("jobs")
      .update({ name: trimmed })
      .eq("id", job.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
  }

  async function toggleActive(job: Job) {
    const supabase = createClient();
    if (!supabase) return;
    const { error: updateError } = await supabase
      .from("jobs")
      .update({ is_active: !job.is_active })
      .eq("id", job.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={addJob} className="space-y-3 rounded-lg border border-border p-4">
        <Label htmlFor="jobName">Add job site</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="jobName"
            className="min-h-11"
            placeholder="e.g. Downtown Clinic Remodel"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button type="submit" className="min-h-11 sm:w-auto" disabled={saving}>
            {saving ? "Adding…" : "Add job"}
          </Button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading jobs…</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <Input
                className="min-h-11"
                defaultValue={job.name}
                aria-label={`Name for ${job.name}`}
                onBlur={(e) => void renameJob(job, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-xs font-medium capitalize",
                    job.is_active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {job.is_active ? "Active" : "Inactive"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void toggleActive(job)}
                >
                  {job.is_active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </li>
          ))}
          {!jobs.length ? (
            <li className="p-4 text-sm text-muted-foreground">
              No jobs yet. Add your first job site above.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
