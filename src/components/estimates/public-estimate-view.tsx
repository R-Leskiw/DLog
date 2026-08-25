"use client";

import { useCallback, useEffect, useState } from "react";

import { EstimateReview } from "@/components/estimates/estimate-review";
import { siteConfig } from "@/config/site";
import type { PublicEstimate } from "@/types/estimates";

export function PublicEstimateView({ token }: { token: string }) {
  const [estimate, setEstimate] = useState<PublicEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/p/${token}`);
    const data = (await res.json().catch(() => null)) as {
      estimate?: PublicEstimate;
      error?: string;
    } | null;
    if (!res.ok || !data?.estimate) {
      setError(data?.error ?? "This estimate link is invalid.");
      setEstimate(null);
      setLoading(false);
      return;
    }
    setEstimate(data.estimate);
    setError(null);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-8">
      <p className="mb-6 font-heading text-lg">{siteConfig.name}</p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading estimate…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {estimate ? (
        <EstimateReview
          estimate={estimate}
          pdfHref={`/api/p/${token}/pdf`}
          signHref={`/api/p/${token}/sign`}
          declineHref={`/api/p/${token}/decline`}
          onChanged={() => void load()}
        />
      ) : null}
    </div>
  );
}
