import { randomBytes } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ESTIMATE_DOCS_BUCKET } from "@/lib/estimates/constants";
import { buildEstimatePdf, downloadStorageBytes } from "@/lib/estimates/pdf";
import {
  estimateTotals,
  jobFieldsFromJoin,
  num,
  toPublicEstimate,
  validJobClients,
  type Estimate,
  type EstimateLine,
  type EstimateStatus,
  type LineCategory,
  type PublicEstimate,
} from "@/types/estimates";

const ESTIMATE_SELECT =
  "id, job_id, title, status, markup_percent, tax_percent, created_at, version, parent_estimate_id, cover_note, share_token, sent_at, signed_at, signed_name, signature_image_path, declined_at, pdf_path, jobs(name, client_name, client_email, client_user_id, job_clients(id, full_name, email, client_user_id, sort_order))";

export function newShareToken() {
  return randomBytes(24).toString("base64url");
}

export async function insertAudit(
  admin: SupabaseClient,
  row: {
    estimate_id: string;
    action: string;
    from_status?: string | null;
    to_status?: string | null;
    actor_id?: string | null;
    actor_label?: string | null;
  }
) {
  await admin.from("estimate_audit").insert({
    estimate_id: row.estimate_id,
    action: row.action,
    from_status: row.from_status ?? null,
    to_status: row.to_status ?? null,
    actor_id: row.actor_id ?? null,
    actor_label: row.actor_label ?? null,
  });
}

function mapHeader(
  row: Record<string, unknown>,
  lines: EstimateLine[]
): Estimate {
  const job = jobFieldsFromJoin(row.jobs);
  return {
    id: row.id as string,
    job_id: (row.job_id as string | null) ?? null,
    title: (row.title as string) ?? "",
    status: row.status as EstimateStatus,
    markup_percent: num(row.markup_percent),
    tax_percent: num(row.tax_percent),
    created_at: row.created_at as string,
    jobName: job.name,
    lines,
    version: Number(row.version) || 1,
    parent_estimate_id: (row.parent_estimate_id as string | null) ?? null,
    cover_note: (row.cover_note as string) ?? "",
    share_token: (row.share_token as string | null) ?? null,
    sent_at: (row.sent_at as string | null) ?? null,
    signed_at: (row.signed_at as string | null) ?? null,
    signed_name: (row.signed_name as string | null) ?? null,
    signature_image_path: (row.signature_image_path as string | null) ?? null,
    declined_at: (row.declined_at as string | null) ?? null,
    pdf_path: (row.pdf_path as string | null) ?? null,
    clients: job.clients,
    clientName: job.client_name,
  };
}

async function loadLines(admin: SupabaseClient, estimateId: string) {
  const { data, error } = await admin
    .from("estimate_line_items")
    .select("id, estimate_id, sort_order, category, description, quantity, unit, unit_cost")
    .eq("estimate_id", estimateId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    key: row.id as string,
    category: row.category as LineCategory,
    description: row.description as string,
    quantity: num(row.quantity),
    unit: (row.unit as string | null) ?? "",
    unit_cost: num(row.unit_cost),
  })) satisfies EstimateLine[];
}

export async function loadEstimateById(
  admin: SupabaseClient,
  estimateId: string
): Promise<Estimate | null> {
  const { data, error } = await admin
    .from("estimates")
    .select(ESTIMATE_SELECT)
    .eq("id", estimateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const lines = await loadLines(admin, estimateId);
  return mapHeader(data as Record<string, unknown>, lines);
}

export async function loadEstimateByToken(
  admin: SupabaseClient,
  token: string
): Promise<Estimate | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const { data, error } = await admin
    .from("estimates")
    .select(ESTIMATE_SELECT)
    .eq("share_token", trimmed)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const lines = await loadLines(admin, data.id as string);
  return mapHeader(data as Record<string, unknown>, lines);
}

export function publicPayload(estimate: Estimate): PublicEstimate {
  return toPublicEstimate(estimate);
}

function parsePngDataUrl(dataUrl: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  return Buffer.from(match[1], "base64");
}

export function canSend(estimate: Estimate) {
  const jobName = estimate.jobName?.trim();
  const ready = validJobClients(estimate.clients);
  const lines = estimate.lines.filter((l) => l.description.trim());
  if (!jobName) return "Select a job with a name before sending.";
  if (!ready.length) {
    return "Add at least one client with a name and email on the job before sending.";
  }
  if (!lines.length) return "Add at least one line item before sending.";
  if (estimate.status === "accepted" || estimate.status === "declined") {
    return "This estimate is locked. Duplicate it as a new version.";
  }
  return null;
}

export async function sendEstimate(opts: {
  admin: SupabaseClient;
  estimateId: string;
  actorId: string;
  origin: string;
}) {
  const estimate = await loadEstimateById(opts.admin, opts.estimateId);
  if (!estimate) return { error: "Estimate not found.", status: 404 as const };
  const blocked = canSend(estimate);
  if (blocked) return { error: blocked, status: 400 as const };

  const token = estimate.share_token || newShareToken();
  const fromStatus = estimate.status;
  const { error } = await opts.admin
    .from("estimates")
    .update({
      status: "sent",
      share_token: token,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", estimate.id);
  if (error) return { error: error.message, status: 500 as const };

  await insertAudit(opts.admin, {
    estimate_id: estimate.id,
    action: "send",
    from_status: fromStatus,
    to_status: "sent",
    actor_id: opts.actorId,
    actor_label: "staff",
  });

  const shareUrl = `${opts.origin}/p/${token}`;
  const totals = estimateTotals(
    estimate.lines,
    estimate.markup_percent,
    estimate.tax_percent
  );
  const emailed = await emailShareLink({
    to: validJobClients(estimate.clients).map((c) => c.email.trim()),
    jobName: estimate.jobName!,
    title: estimate.title,
    total: totals.total,
    shareUrl,
  });

  return { shareUrl, emailed, error: null, status: 200 as const };
}

async function emailShareLink(opts: {
  to: string[];
  jobName: string;
  title: string;
  total: number;
  shareUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from || opts.to.length === 0) return false;
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject: `Estimate ready to review: ${opts.title}`,
    html: `
      <p>An estimate for <strong>${escapeHtml(opts.jobName)}</strong> is ready for your review.</p>
      <p>Total: <strong>${escapeHtml(
        opts.total.toLocaleString(undefined, { style: "currency", currency: "CAD" })
      )}</strong></p>
      <p><a href="${opts.shareUrl}">Review and sign</a></p>
      <p>If the button does not work, copy this link:<br/>${escapeHtml(opts.shareUrl)}</p>
    `,
  });
  return !error;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function signEstimate(opts: {
  admin: SupabaseClient;
  estimate: Estimate;
  signedName: string;
  signatureDataUrl?: string | null;
  actorId?: string | null;
  actorLabel: string;
}) {
  if (opts.estimate.status !== "sent") {
    return { error: "This estimate is not awaiting a signature.", status: 400 as const };
  }
  const signedName = opts.signedName.trim();
  if (!signedName) {
    return { error: "Type your name to sign.", status: 400 as const };
  }

  let signaturePath: string | null = opts.estimate.signature_image_path;
  const png = opts.signatureDataUrl ? parsePngDataUrl(opts.signatureDataUrl) : null;
  if (png) {
    signaturePath = `signatures/${opts.estimate.id}.png`;
    const { error: uploadError } = await opts.admin.storage
      .from(ESTIMATE_DOCS_BUCKET)
      .upload(signaturePath, png, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) {
      return { error: uploadError.message, status: 500 as const };
    }
  }

  const signedAt = new Date();
  const { data: settings } = await opts.admin
    .from("company_settings")
    .select("contract_pdf_path")
    .eq("id", 1)
    .maybeSingle();
  const contractPdf = await downloadStorageBytes(
    opts.admin,
    settings?.contract_pdf_path
  );
  const signaturePng = png
    ? new Uint8Array(png)
    : await downloadStorageBytes(opts.admin, signaturePath);

  let pdfPath: string | null = null;
  try {
    const bytes = await buildEstimatePdf({
      title: opts.estimate.title,
      version: opts.estimate.version,
      coverNote: opts.estimate.cover_note,
      jobName: opts.estimate.jobName ?? "",
      clientName: opts.estimate.clientName ?? "",
      dateLabel: signedAt.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      lines: opts.estimate.lines,
      markupPercent: opts.estimate.markup_percent,
      taxPercent: opts.estimate.tax_percent,
      signedName,
      signedAtLabel: signedAt.toLocaleString(),
      signaturePng,
      contractPdf,
    });
    pdfPath = `signed/${opts.estimate.id}.pdf`;
    await opts.admin.storage.from(ESTIMATE_DOCS_BUCKET).upload(pdfPath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  } catch {
    pdfPath = null;
  }

  const { error } = await opts.admin
    .from("estimates")
    .update({
      status: "accepted",
      signed_at: signedAt.toISOString(),
      signed_name: signedName,
      signature_image_path: signaturePath,
      pdf_path: pdfPath,
      updated_at: signedAt.toISOString(),
    })
    .eq("id", opts.estimate.id);
  if (error) return { error: error.message, status: 500 as const };

  await insertAudit(opts.admin, {
    estimate_id: opts.estimate.id,
    action: "sign",
    from_status: "sent",
    to_status: "accepted",
    actor_id: opts.actorId ?? null,
    actor_label: opts.actorLabel,
  });

  return { error: null, status: 200 as const };
}

export async function declineEstimate(opts: {
  admin: SupabaseClient;
  estimate: Estimate;
  actorId?: string | null;
  actorLabel: string;
}) {
  if (opts.estimate.status !== "sent") {
    return { error: "This estimate is not awaiting a response.", status: 400 as const };
  }
  const { error } = await opts.admin
    .from("estimates")
    .update({
      status: "declined",
      declined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", opts.estimate.id);
  if (error) return { error: error.message, status: 500 as const };

  await insertAudit(opts.admin, {
    estimate_id: opts.estimate.id,
    action: "decline",
    from_status: "sent",
    to_status: "declined",
    actor_id: opts.actorId ?? null,
    actor_label: opts.actorLabel,
  });

  return { error: null, status: 200 as const };
}
