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
