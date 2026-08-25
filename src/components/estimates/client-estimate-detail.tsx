"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { EstimateReview } from "@/components/estimates/estimate-review";
import { createClient } from "@/lib/supabase/client";
import {
  jobFieldsFromJoin,
  num,
  type EstimateLine,
  type EstimateStatus,
  type LineCategory,
  type PublicEstimate,
} from "@/types/estimates";

export function ClientEstimateDetail({ estimateId }: { estimateId: string }) {
  const [estimate, setEstimate] = useState<PublicEstimate | null>(null);
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
      .eq("id", estimateId)
      .maybeSingle();
    if (loadError || !data) {
      setError(loadError?.message ?? "Estimate not found.");
      setEstimate(null);
      setLoading(false);
      return;
    }
    const { data: lineRows, error: lineError } = await supabase
      .from("estimate_line_items")
      .select("id, category, description, quantity, unit, unit_cost")
      .eq("estimate_id", estimateId)
      .order("sort_order");
    if (lineError) {
      setError(lineError.message);
      setLoading(false);
      return;
    }
    const job = jobFieldsFromJoin(data.jobs);
    const lines: EstimateLine[] = (lineRows ?? []).map((row) => ({
      id: row.id,
      key: row.id,
      category: row.category as LineCategory,
      description: row.description,
      quantity: num(row.quantity),
      unit: row.unit ?? "",
      unit_cost: num(row.unit_cost),
    }));
    setEstimate({
      id: data.id,
      title: data.title,
      status: data.status as EstimateStatus,
      version: Number(data.version) || 1,
      cover_note: data.cover_note ?? "",
      jobName: job.name,
      clientName: job.client_name,
      signed_at: data.signed_at,
      signed_name: data.signed_name,
      declined_at: data.declined_at,
      sent_at: data.sent_at,
      lines,
      markup_percent: num(data.markup_percent),
      tax_percent: num(data.tax_percent),
    });
    setError(null);
    setLoading(false);
  }, [estimateId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 md:px-8">
      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/my-estimates" className="underline hover:text-foreground">
          Estimates
        </Link>
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading estimate…</p>
      ) : estimate ? (
        <EstimateReview
          estimate={estimate}
          pdfHref={`/api/estimates/${estimate.id}/pdf`}
          signHref={`/api/estimates/${estimate.id}/sign`}
          declineHref={`/api/estimates/${estimate.id}/decline`}
          onChanged={() => void load()}
        />
      ) : null}
    </main>
  );
}
