"use client";

import { useState } from "react";

import { SignaturePad } from "@/components/estimates/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyCoverPlaceholders,
  estimateTotals,
  formatMoney,
  isEstimateLocked,
  lineTotal,
  statusLabel,
  type PublicEstimate,
} from "@/types/estimates";

export function EstimateReview({
  estimate,
  pdfHref,
  signHref,
  declineHref,
  onChanged,
}: {
  estimate: PublicEstimate;
  pdfHref: string;
  signHref: string;
  declineHref: string;
  onChanged?: () => void;
}) {
  const [name, setName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = isEstimateLocked(estimate);
  const awaiting = estimate.status === "sent";
  const totals = estimateTotals(
    estimate.lines,
    estimate.markup_percent,
    estimate.tax_percent
  );
  const cover = applyCoverPlaceholders(
    estimate.cover_note ||
      "Please review this estimate for {{job_name}}. Total: {{total_price}}.",
    {
      clientName: estimate.clientName || "Client",
      jobName: estimate.jobName || "this project",
      totalPrice: formatMoney(totals.total),
    }
  );

  async function post(url: string, body?: unknown) {
    setSaving(true);
    setError(null);
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);
    if (!res.ok) {
      setError(data?.error ?? "Something went wrong.");
      return;
    }
    onChanged?.();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">
          V{estimate.version} · {statusLabel(estimate.status)}
          {estimate.jobName ? ` · ${estimate.jobName}` : ""}
        </p>
        <h1 className="font-heading text-3xl">
          {estimate.title.trim() || "Estimate"}
        </h1>
      </header>

      <p className="whitespace-pre-wrap text-sm leading-relaxed">{cover}</p>

      <p>
        <a
          href={pdfHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
        >
          View PDF
        </a>
      </p>

      <ul className="space-y-3">
        {estimate.lines.map((line) => (
          <li
            key={line.key}
            className="flex items-baseline justify-between gap-4 rounded-xl border border-border p-3"
          >
            <span>
              <span className="block font-medium">{line.description}</span>
              <span className="text-xs text-muted-foreground">
                {line.quantity}
                {line.unit ? ` ${line.unit}` : ""}
              </span>
            </span>
            <span className="tabular-nums">{formatMoney(lineTotal(line))}</span>
          </li>
        ))}
      </ul>

      <dl className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex justify-between text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-2">
          <dt className="font-heading text-lg">Total</dt>
          <dd className="font-heading text-lg tabular-nums">
            {formatMoney(totals.total)}
          </dd>
        </div>
      </dl>

      {estimate.status === "accepted" ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          Signed by {estimate.signed_name || "the client"}
          {estimate.signed_at
            ? ` on ${new Date(estimate.signed_at).toLocaleString()}`
            : ""}
          . This document is locked.
        </p>
      ) : null}

      {estimate.status === "declined" ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          This estimate was declined
          {estimate.declined_at
            ? ` on ${new Date(estimate.declined_at).toLocaleString()}`
            : ""}
          .
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {awaiting && !locked ? (
        <section className="space-y-4 rounded-xl border border-border p-4">
          <h2 className="font-heading text-xl">Sign to accept</h2>
          <div className="space-y-1.5">
            <Label htmlFor="sign-name">Full name</Label>
            <Input
              id="sign-name"
              className="min-h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Draw signature (optional)</Label>
            <SignaturePad onChange={setSignature} disabled={saving} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="min-h-11"
              disabled={saving || !name.trim()}
              onClick={() =>
                void post(signHref, {
                  signedName: name,
                  signatureDataUrl: signature,
                })
              }
            >
              {saving ? "Saving…" : "Accept and sign"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => void post(declineHref)}
            >
              Decline
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
