import { addDays, parseISODate, toISODate } from "@/lib/schedule/dates";

export type TemplateItemInput = {
  title: string;
  duration_days: number;
  lag_days: number;
  sort_order: number;
  notes?: string | null;
};

/**
 * Sequential finish-to-start placement from a project start date.
 * Item 0 starts on `projectStart`; later items start after the previous end + lag.
 */
export function placeTemplateItems(
  projectStart: string,
  items: TemplateItemInput[]
): { title: string; start_date: string; end_date: string; notes: string | null; sort_order: number }[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  let cursor = projectStart;
  const placed: {
    title: string;
    start_date: string;
    end_date: string;
    notes: string | null;
    sort_order: number;
  }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (i > 0) {
      cursor = toISODate(addDays(parseISODate(cursor), item.lag_days));
    }
    const start = cursor;
    const end = toISODate(
      addDays(parseISODate(start), Math.max(1, item.duration_days) - 1)
    );
    placed.push({
      title: item.title,
      start_date: start,
      end_date: end,
      notes: item.notes ?? null,
      sort_order: item.sort_order,
    });
    cursor = toISODate(addDays(parseISODate(end), 1));
  }

  return placed;
}
