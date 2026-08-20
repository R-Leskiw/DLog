"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { EstimateEditor } from "@/components/estimates/estimate-editor";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Job } from "@/types/logs";
import {
  emptyLine,
  estimateTotals,
  formatMoney,
  num,
  statusLabel,
  NEW_JOB_VALUE,
  type Estimate,
  type EstimateLine,
  type EstimateStatus,
  type LineCategory,
} from "@/types/estimates";
import { cn } from "@/lib/utils";

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

function blankEstimate(): Estimate {
  return {
    id: `new-${crypto.randomUUID()}`,
    job_id: null,
    title: "",
    status: "draft",
    markup_percent: 0,
    tax_percent: 0,
    created_at: new Date().toISOString(),
    jobName: null,
    lines: [emptyLine()],
  };
}

export function EstimatesBoard({ canEdit }: { canEdit: boolean }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selected, setSelected] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const [jobsRes, estRes] = await Promise.all([
      supabase.from("jobs").select("id, name, is_active").order("name"),
      supabase
        .from("estimates")
        .select("id, job_id, title, status, markup_percent, tax_percent, created_at, jobs(name)")
        .order("updated_at", { ascending: false }),
    ]);

    if (estRes.error && isMissingRelation(estRes.error.message)) {
      setSchemaReady(false);
      setError(null);
      setLoading(false);
      return;
    }
    setSchemaReady(true);

    if (estRes.error) {
      setError(estRes.error.message);
      setLoading(false);
      return;
    }

    const headers = estRes.data ?? [];
    const ids = headers.map((e) => e.id as string);
    const linesByEstimate = new Map<string, EstimateLine[]>();

    if (ids.length) {
      const { data: lineRows, error: lineError } = await supabase
        .from("estimate_line_items")
        .select(
          "id, estimate_id, sort_order, category, description, quantity, unit, unit_cost"
        )
        .in("estimate_id", ids)
        .order("sort_order");
      if (lineError) {
        setError(lineError.message);
        setLoading(false);
        return;
      }
      for (const row of lineRows ?? []) {
        const list = linesByEstimate.get(row.estimate_id) ?? [];
        list.push({
          id: row.id,
          key: row.id,
          category: row.category as LineCategory,
          description: row.description,
          quantity: num(row.quantity),
          unit: row.unit ?? "",
          unit_cost: num(row.unit_cost),
        });
        linesByEstimate.set(row.estimate_id, list);
      }
    }

    const mapped: Estimate[] = headers.map((row) => ({
      id: row.id,
      job_id: row.job_id,
      title: row.title,
      status: row.status as EstimateStatus,
      markup_percent: num(row.markup_percent),
      tax_percent: num(row.tax_percent),
      created_at: row.created_at,
      jobName: jobNameFromJoin(row.jobs as { name: string } | { name: string }[] | null),
      lines: linesByEstimate.get(row.id) ?? [],
    }));

    setJobs((jobsRes.data as Job[]) ?? []);
    setEstimates(mapped);
    setError(jobsRes.error?.message ?? null);
    setLoading(false);
    setSelected((current) => {
      if (!current || current.id.startsWith("new-")) return current;
      return mapped.find((e) => e.id === current.id) ?? current;
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!selected || !canEdit) return;
    const title = selected.title.trim();
    if (!title) {
      setError("Add a title before saving.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("You need to be signed in.");
      return;
    }

    let jobId = selected.job_id;
    if (jobId === NEW_JOB_VALUE) {
      const jobName = selected.newJobName?.trim();
      if (!jobName) {
        setSaving(false);
        setError("Enter a name for the new job.");
        return;
      }
      const existing = jobs.find(
        (j) => j.name.trim().toLowerCase() === jobName.toLowerCase()
      );
      if (existing) {
        jobId = existing.id;
      } else {
        const { data: jobRow, error: jobError } = await supabase
          .from("jobs")
          .insert({ name: jobName, is_active: true })
          .select("id")
          .single();
        if (jobError || !jobRow) {
          setSaving(false);
          setError(jobError?.message ?? "Could not create the job.");
          return;
        }
        jobId = jobRow.id;
      }
    }

    const header = {
      title,
      job_id: jobId,
      status: selected.status,
      markup_percent: selected.markup_percent,
      tax_percent: selected.tax_percent,
      updated_at: new Date().toISOString(),
    };

    let estimateId = selected.id.startsWith("new-") ? null : selected.id;
    if (estimateId) {
      const { error: updateError } = await supabase
        .from("estimates")
        .update(header)
        .eq("id", estimateId);
      if (updateError) {
        setSaving(false);
        setError(updateError.message);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("estimates")
        .insert({ ...header, created_by: user.id })
        .select("id")
        .single();
      if (insertError || !data) {
        setSaving(false);
        setError(insertError?.message ?? "Could not save estimate.");
        return;
      }
      estimateId = data.id;
    }

    const { error: delError } = await supabase
      .from("estimate_line_items")
      .delete()
      .eq("estimate_id", estimateId);
    if (delError) {
      setSaving(false);
      setError(delError.message);
      return;
    }

    const lines = selected.lines.filter((l) => l.description.trim());
    if (lines.length) {
      const { error: lineError } = await supabase.from("estimate_line_items").insert(
        lines.map((line, index) => ({
          estimate_id: estimateId,
          sort_order: index,
          category: line.category,
          description: line.description.trim(),
          quantity: line.quantity,
          unit: line.unit.trim() || null,
          unit_cost: line.unit_cost,
        }))
      );
      if (lineError) {
        setSaving(false);
        setError(lineError.message);
        return;
      }
    }

    setSaving(false);
    setSelected(null);
    await load();
  }

  async function remove() {
    if (!selected || selected.id.startsWith("new-")) return;
    if (!window.confirm("Delete this estimate?")) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    const { error: delError } = await supabase
      .from("estimates")
      .delete()
      .eq("id", selected.id);
    setSaving(false);
    if (delError) {
      setError(delError.message);
      return;
    }
    setSelected(null);
    await load();
  }

  const list = useMemo(() => estimates, [estimates]);

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-4 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl">Estimates</h1>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "Build bids with materials, labor, markup, and tax."
              : "Review estimates. Only admins can edit."}
          </p>
        </div>
        {canEdit && schemaReady ? (
          <Button
            type="button"
            className="min-h-11 print:hidden"
            onClick={() => setSelected(blankEstimate())}
          >
            New estimate
          </Button>
        ) : null}
      </header>

      {!schemaReady ? (
        <p className="mx-4 mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground md:mx-8">
          Run{" "}
          <code className="rounded bg-muted px-1 text-xs">
            supabase/migrations/0004_schedule_timeclock_messages_estimates.sql
          </code>{" "}
          in the Supabase SQL Editor to enable estimates.
        </p>
      ) : null}

      {error ? (
        <p className="px-4 pt-3 text-sm text-destructive md:px-8" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading estimates…</p>
      ) : selected ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
          <div className="mx-auto w-full max-w-3xl">
            <EstimateEditor
              jobs={jobs}
              estimate={selected}
              canEdit={canEdit}
              saving={saving}
              onChange={setSelected}
              onSave={() => void save()}
              onCancel={() => setSelected(null)}
              onDelete={canEdit ? () => void remove() : undefined}
            />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 && schemaReady ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No estimates yet.
              {canEdit ? " Create the first bid for a job." : ""}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((estimate) => {
                const totals = estimateTotals(
                  estimate.lines,
                  estimate.markup_percent,
                  estimate.tax_percent
                );
                return (
                  <li key={estimate.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(estimate)}
                      className={cn(
                        "flex min-h-11 w-full items-baseline justify-between gap-4 px-4 py-4 text-left md:px-8",
                        "hover:bg-muted/60"
                      )}
                    >
                      <span>
                        <span className="block font-medium">
                          {estimate.title.trim() || "Untitled estimate"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {statusLabel(estimate.status)}
                          {estimate.jobName ? ` · ${estimate.jobName}` : ""}
                        </span>
                      </span>
                      <span className="font-heading tabular-nums">
                        {formatMoney(totals.total)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
