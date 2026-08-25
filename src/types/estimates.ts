import type { JobClient } from "@/types/logs";

export const ESTIMATE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
] as const;

export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const LINE_CATEGORIES = [
  "material",
  "labor",
  "subcontractor",
  "other",
] as const;

export type LineCategory = (typeof LINE_CATEGORIES)[number];

export type EstimateLine = {
  id?: string;
  key: string;
  category: LineCategory;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
};

export type Estimate = {
  id: string;
  job_id: string | null;
  title: string;
  status: EstimateStatus;
  markup_percent: number;
  tax_percent: number;
  created_at: string;
  jobName: string | null;
  lines: EstimateLine[];
  /** Client-only: set when the Job dropdown is "New job". */
  newJobName?: string;
  version: number;
  parent_estimate_id: string | null;
  cover_note: string;
  share_token: string | null;
  sent_at: string | null;
  signed_at: string | null;
  signed_name: string | null;
  signature_image_path: string | null;
  declined_at: string | null;
  pdf_path: string | null;
  clients: JobClient[];
  clientName: string | null;
};

/** Payload shown to clients and magic-link visitors (no share token). */
export type PublicEstimate = {
  id: string;
  title: string;
  status: EstimateStatus;
  version: number;
  cover_note: string;
  jobName: string | null;
  clientName: string | null;
  signed_at: string | null;
  signed_name: string | null;
  declined_at: string | null;
  sent_at: string | null;
  lines: EstimateLine[];
  markup_percent: number;
  tax_percent: number;
};

export const NEW_JOB_VALUE = "__new__";

export type EstimateTotals = {
  subtotal: number;
  markup: number;
  tax: number;
  total: number;
};

export function statusLabel(status: EstimateStatus) {
  switch (status) {
    case "sent":
      return "Sent";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    default:
      return "Draft";
  }
}

export function categoryLabel(category: LineCategory) {
  switch (category) {
    case "labor":
      return "Labor";
    case "subcontractor":
      return "Subcontractor";
    case "other":
      return "Other";
    default:
      return "Material";
  }
}

export function lineTotal(line: Pick<EstimateLine, "quantity" | "unit_cost">) {
  return Math.max(0, Number(line.quantity) || 0) * Math.max(0, Number(line.unit_cost) || 0);
}

export function estimateTotals(
  lines: Pick<EstimateLine, "quantity" | "unit_cost">[],
  markupPercent: number,
  taxPercent: number
): EstimateTotals {
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const markup = subtotal * (Math.max(0, Number(markupPercent) || 0) / 100);
  const tax = (subtotal + markup) * (Math.max(0, Number(taxPercent) || 0) / 100);
  return {
    subtotal,
    markup,
    tax,
    total: subtotal + markup + tax,
  };
}

export function formatMoney(amount: number) {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "CAD",
  });
}

export function emptyLine(): EstimateLine {
  return {
    key: `new-${crypto.randomUUID()}`,
    category: "material",
    description: "",
    quantity: 1,
    unit: "",
    unit_cost: 0,
  };
}

export function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isEstimateLocked(estimate: {
  status: EstimateStatus;
  signed_at?: string | null;
}) {
  return (
    estimate.status === "accepted" ||
    estimate.status === "declined" ||
    Boolean(estimate.signed_at)
  );
}

export function applyCoverPlaceholders(
  note: string,
  vars: { clientName: string; jobName: string; totalPrice: string }
) {
  return note
    .replaceAll("{{client_name}}", vars.clientName)
    .replaceAll("{{job_name}}", vars.jobName)
    .replaceAll("{{total_price}}", vars.totalPrice);
}

export function formatClientNames(clients: Pick<JobClient, "full_name">[]) {
  const names = clients.map((c) => c.full_name.trim()).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validJobClients(clients: JobClient[]) {
  return clients.filter(
    (c) => c.full_name.trim() && EMAIL_RE.test(c.email.trim())
  );
}

export function estimateIsLinkedToUser(estimate: { clients: JobClient[] }, userId: string) {
  return estimate.clients.some((c) => c.client_user_id === userId);
}

export function parseJobClients(value: unknown): JobClient[] {
  if (!Array.isArray(value)) return [];
  const rows: JobClient[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const email = typeof r.email === "string" ? r.email.trim() : "";
    const full_name = typeof r.full_name === "string" ? r.full_name : "";
    if (!email && !full_name) continue;
    rows.push({
      id: typeof r.id === "string" ? r.id : undefined,
      job_id: typeof r.job_id === "string" ? r.job_id : undefined,
      full_name,
      email,
      client_user_id:
        typeof r.client_user_id === "string" ? r.client_user_id : null,
      sort_order: typeof r.sort_order === "number" ? r.sort_order : 0,
    });
  }
  return rows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export function toPublicEstimate(estimate: Estimate): PublicEstimate {
  return {
    id: estimate.id,
    title: estimate.title,
    status: estimate.status,
    version: estimate.version,
    cover_note: estimate.cover_note,
    jobName: estimate.jobName,
    clientName: estimate.clientName,
    signed_at: estimate.signed_at,
    signed_name: estimate.signed_name,
    declined_at: estimate.declined_at,
    sent_at: estimate.sent_at,
    lines: estimate.lines,
    markup_percent: estimate.markup_percent,
    tax_percent: estimate.tax_percent,
  };
}

export function jobFieldsFromJoin(jobs: unknown): {
  name: string | null;
  clients: JobClient[];
  client_name: string | null;
} {
  const empty = { name: null, clients: [] as JobClient[], client_name: null };
  if (!jobs) return empty;
  const row = Array.isArray(jobs) ? jobs[0] : jobs;
  if (!row || typeof row !== "object") return empty;
  const r = row as Record<string, unknown>;
  let clients = parseJobClients(r.job_clients);
  if (
    !clients.length &&
    typeof r.client_email === "string" &&
    r.client_email.trim()
  ) {
    clients = [
      {
        full_name:
          typeof r.client_name === "string" && r.client_name.trim()
            ? r.client_name
            : "Client",
        email: r.client_email.trim(),
        client_user_id:
          typeof r.client_user_id === "string" ? r.client_user_id : null,
      },
    ];
  }
  return {
    name: typeof r.name === "string" ? r.name : null,
    clients,
    client_name: formatClientNames(clients) || null,
  };
}
