"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import {
  estimateTotals,
  formatMoney,
  jobFieldsFromJoin,
  num,
  statusLabel,
  type EstimateLine,
  type EstimateStatus,
  type LineCategory,
  type PublicEstimate,
} from "@/types/estimates";

export function ClientEstimatesList() {
  const [estimates, setEstimates] = useState<PublicEstimate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const { data, error: loadError } = await supabase
      .from("estimates")
      .select(
        "id, title, status, version, cover_note, markup_percent, tax_percent, signed_at, signed_name, declined_at, sent_at, jobs(name, job_clients(full_name, email, sort_order))"
      )
      .in("status", ["sent", "accepted", "declined"])
      .order("sent_at", { ascending: false });
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }
    const headers = data ?? [];
    const ids = headers.map((row) => row.id as string);
    const linesById = new Map<string, EstimateLine[]>();
    if (ids.length) {
      const { data: lineRows, error: lineError } = await supabase
        .from("estimate_line_items")
        .select("id, estimate_id, category, description, quantity, unit, unit_cost")
        .in("estimate_id", ids);
      if (lineError) {
        setError(lineError.message);
        setLoading(false);
        return;
      }
      for (const row of lineRows ?? []) {
        const list = linesById.get(row.estimate_id) ?? [];
        list.push({
          id: row.id,
          key: row.id,
          category: row.category as LineCategory,
          description: row.description,
          quantity: num(row.quantity),
          unit: row.unit ?? "",
          unit_cost: num(row.unit_cost),
        });
        linesById.set(row.estimate_id, list);
      }
    }
    setEstimates(
      headers.map((row) => {
        const job = jobFieldsFromJoin(row.jobs);
        return {
          id: row.id,
          title: row.title,
          status: row.status as EstimateStatus,
          version: Number(row.version) || 1,
          cover_note: row.cover_note ?? "",
          jobName: job.name,
          clientName: job.client_name,
          signed_at: row.signed_at,
          signed_name: row.signed_name,
          declined_at: row.declined_at,
          sent_at: row.sent_at,
          lines: linesById.get(row.id) ?? [],
          markup_percent: num(row.markup_percent),
          tax_percent: num(row.tax_percent),
        };
      })
    );
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 md:px-8">
      <header className="mb-6">
        <h1 className="font-heading text-2xl md:text-3xl">Estimates</h1>
        <p className="text-sm text-muted-foreground">
          Review, sign, or decline estimates sent for your project.
        </p>
      </header>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading estimates…</p>
      ) : estimates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No estimates have been sent to you yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {estimates.map((estimate) => {
            const totals = estimateTotals(
              estimate.lines,
              estimate.markup_percent,
              estimate.tax_percent
            );
            return (
              <li key={estimate.id}>
                <Link
                  href={`/my-estimates/${estimate.id}`}
                  className="flex min-h-11 items-baseline justify-between gap-4 px-4 py-4 hover:bg-muted/60"
                >
                  <span>
                    <span className="block font-medium">
                      {estimate.title.trim() || "Estimate"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      V{estimate.version} · {statusLabel(estimate.status)}
                      {estimate.jobName ? ` · ${estimate.jobName}` : ""}
                    </span>
                  </span>
                  <span className="font-heading tabular-nums">
                    {formatMoney(totals.total)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
