import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ESTIMATE_DOCS_BUCKET } from "@/lib/estimates/constants";
import {
  applyCoverPlaceholders,
  categoryLabel,
  estimateTotals,
  formatMoney,
  jobFieldsFromJoin,
  lineTotal,
  type EstimateLine,
  type LineCategory,
} from "@/types/estimates";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const BOTTOM = 56;
const BRAND = rgb(0.98, 0.8, 0.08);
const INK = rgb(0.12, 0.12, 0.12);
const MUTED = rgb(0.4, 0.4, 0.4);

function winAnsi(text: string) {
  return text.replace(/[^\t\n\r\x20-\x7E]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const paragraphs = winAnsi(text).replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }
      let chunk = "";
      for (const ch of word) {
        const trial = chunk + ch;
        if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
          chunk = trial;
        } else {
          if (chunk) lines.push(chunk);
          chunk = ch;
        }
      }
      current = chunk;
    }
    if (current) lines.push(current);
  }
  return lines;
}

type Cursor = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
};

function ensureSpace(ctx: Cursor, needed: number) {
  if (ctx.y - needed >= BOTTOM) return;
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

function drawLines(
  ctx: Cursor,
  text: string,
  opts: { size: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number }
) {
  const font = opts.font ?? ctx.font;
  const size = opts.size;
  const gap = opts.gap ?? size + 4;
  const color = opts.color ?? INK;
  const width = PAGE_W - MARGIN * 2;
  for (const line of wrapText(text, font, size, width)) {
    ensureSpace(ctx, gap);
    if (line) {
      ctx.page.drawText(line, {
        x: MARGIN,
        y: ctx.y,
        size,
        font,
        color,
      });
    }
    ctx.y -= gap;
  }
}

export async function buildEstimatePdf(input: {
  title: string;
  version: number;
  coverNote: string;
  jobName: string;
  clientName: string;
  dateLabel: string;
  lines: EstimateLine[];
  markupPercent: number;
  taxPercent: number;
  signedName: string | null;
  signedAtLabel: string | null;
  signaturePng: Uint8Array | null;
  contractPdf: Uint8Array | null;
}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const ctx: Cursor = { doc, page, font, bold, y: PAGE_H - MARGIN };

  const totals = estimateTotals(input.lines, input.markupPercent, input.taxPercent);
  const filledCover = applyCoverPlaceholders(
    input.coverNote.trim() ||
      "Please review this estimate for {{job_name}}. Total: {{total_price}}.",
    {
      clientName: input.clientName || "Client",
      jobName: input.jobName || "this project",
      totalPrice: formatMoney(totals.total),
    }
  );

  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 6,
    width: 48,
    height: 8,
    color: BRAND,
  });
  ctx.y -= 22;
  drawLines(ctx, "BuildTrack Estimate", { size: 11, font: bold, color: MUTED, gap: 16 });
  drawLines(ctx, input.title || "Estimate", { size: 22, font: bold, gap: 26 });
  drawLines(
    ctx,
    `Version ${input.version}  |  ${input.dateLabel}`,
    { size: 10, color: MUTED, gap: 14 }
  );
  drawLines(ctx, `Job: ${input.jobName || "—"}`, { size: 11, gap: 14 });
  drawLines(ctx, `Prepared for: ${input.clientName || "—"}`, { size: 11, gap: 18 });

  ctx.y -= 4;
  drawLines(ctx, filledCover, { size: 11, gap: 15 });
  ctx.y -= 8;

  drawLines(ctx, "Line items", { size: 14, font: bold, gap: 20 });

  for (const line of input.lines) {
    const amount = formatMoney(lineTotal(line));
    const qty = `${line.quantity}${line.unit ? ` ${line.unit}` : ""}`;
    const head = `${categoryLabel(line.category as LineCategory)}  ·  ${qty}  ·  ${amount}`;
    ensureSpace(ctx, 36);
    drawLines(ctx, line.description || "Item", { size: 11, font: bold, gap: 14 });
    drawLines(ctx, head, { size: 10, color: MUTED, gap: 16 });
  }

  ctx.y -= 6;
  ensureSpace(ctx, 90);
  const rows: [string, string][] = [
    ["Subtotal", formatMoney(totals.subtotal)],
    [`Markup (${input.markupPercent || 0}%)`, formatMoney(totals.markup)],
    [`Tax (${input.taxPercent || 0}%)`, formatMoney(totals.tax)],
    ["Total", formatMoney(totals.total)],
  ];
  for (const [label, value] of rows) {
    const isTotal = label === "Total";
    const size = isTotal ? 13 : 11;
    const f = isTotal ? bold : font;
    ensureSpace(ctx, size + 8);
    ctx.page.drawText(winAnsi(label), {
      x: MARGIN,
      y: ctx.y,
      size,
      font: f,
      color: INK,
    });
    ctx.page.drawText(winAnsi(value), {
      x: PAGE_W - MARGIN - f.widthOfTextAtSize(winAnsi(value), size),
      y: ctx.y,
      size,
      font: f,
      color: INK,
    });
    ctx.y -= size + 8;
  }

  ctx.y -= 16;
  drawLines(ctx, "Signature", { size: 14, font: bold, gap: 18 });

  if (input.signaturePng) {
    try {
      const image = await doc.embedPng(input.signaturePng);
      const maxW = 220;
      const scale = Math.min(maxW / image.width, 70 / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      ensureSpace(ctx, h + 36);
      ctx.page.drawImage(image, { x: MARGIN, y: ctx.y - h, width: w, height: h });
      ctx.y -= h + 10;
    } catch {
      drawLines(ctx, "(Signature image could not be embedded.)", {
        size: 10,
        color: MUTED,
        gap: 14,
      });
    }
  } else {
    ensureSpace(ctx, 56);
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y - 44,
      width: 240,
      height: 44,
      borderColor: MUTED,
      borderWidth: 1,
    });
    ctx.y -= 56;
  }

  if (input.signedName) {
    drawLines(ctx, `Signed by: ${input.signedName}`, { size: 11, font: bold, gap: 14 });
  }
  if (input.signedAtLabel) {
    drawLines(ctx, `Date: ${input.signedAtLabel}`, { size: 10, color: MUTED, gap: 14 });
  }
  if (!input.signedName) {
    drawLines(ctx, "Awaiting client signature.", { size: 10, color: MUTED, gap: 14 });
  }

  if (input.contractPdf) {
    try {
      const contract = await PDFDocument.load(input.contractPdf);
      const copied = await doc.copyPages(contract, contract.getPageIndices());
      for (const p of copied) doc.addPage(p);
    } catch {
      const extra = doc.addPage([PAGE_W, PAGE_H]);
      extra.drawText("Company contract PDF could not be appended.", {
        x: MARGIN,
        y: PAGE_H - MARGIN,
        size: 11,
        font,
        color: MUTED,
      });
    }
  }

  return doc.save();
}

export async function downloadStorageBytes(
  admin: SupabaseClient,
  path: string | null | undefined
) {
  if (!path) return null;
  const { data, error } = await admin.storage
    .from(ESTIMATE_DOCS_BUCKET)
    .download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function generateEstimatePdfBytes(
  admin: SupabaseClient,
  estimateId: string
) {
  const { data: header, error } = await admin
    .from("estimates")
    .select(
      "id, title, status, version, cover_note, markup_percent, tax_percent, signed_at, signed_name, signature_image_path, created_at, sent_at, jobs(name, job_clients(full_name, email, sort_order))"
    )
    .eq("id", estimateId)
    .maybeSingle();
  if (error || !header) {
    throw new Error(error?.message ?? "Estimate not found.");
  }

  const { data: lineRows } = await admin
    .from("estimate_line_items")
    .select("category, description, quantity, unit, unit_cost")
    .eq("estimate_id", estimateId)
    .order("sort_order");

  const { data: settings } = await admin
    .from("company_settings")
    .select("contract_pdf_path")
    .eq("id", 1)
    .maybeSingle();

  const job = jobFieldsFromJoin(header.jobs);
  const lines: EstimateLine[] = (lineRows ?? []).map((row, index) => ({
    key: `pdf-${index}`,
    category: row.category as LineCategory,
    description: row.description,
    quantity: Number(row.quantity) || 0,
    unit: row.unit ?? "",
    unit_cost: Number(row.unit_cost) || 0,
  }));

  const signaturePng = await downloadStorageBytes(
    admin,
    header.signature_image_path
  );
  const contractPdf = await downloadStorageBytes(
    admin,
    settings?.contract_pdf_path
  );

  const date = header.sent_at || header.created_at;
  const dateLabel = date
    ? new Date(date).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const signedAtLabel = header.signed_at
    ? new Date(header.signed_at).toLocaleString()
    : null;

  return buildEstimatePdf({
    title: header.title,
    version: Number(header.version) || 1,
    coverNote: header.cover_note ?? "",
    jobName: job.name ?? "",
    clientName: job.client_name ?? "",
    dateLabel,
    lines,
    markupPercent: Number(header.markup_percent) || 0,
    taxPercent: Number(header.tax_percent) || 0,
    signedName: header.signed_name,
    signedAtLabel,
    signaturePng,
    contractPdf,
  });
}
