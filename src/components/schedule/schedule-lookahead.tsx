"use client";

import { formatShort } from "@/lib/schedule/dates";
import { statusLabel, type ScheduleTask } from "@/types/schedule";

export function ScheduleLookahead({
  tasks,
  todayIso,
  horizonEnd,
  onSelect,
  canEdit,
}: {
  tasks: ScheduleTask[];
  todayIso: string;
  horizonEnd: string;
  onSelect: (task: ScheduleTask) => void;
  canEdit: boolean;
}) {
  const overdue = tasks.filter(
    (t) => t.end_date < todayIso && t.status !== "done"
  );
  const startingSoon = tasks.filter(
    (t) =>
      t.start_date >= todayIso &&
      t.start_date <= horizonEnd &&
      t.status !== "done"
  );
  const inProgress = tasks.filter(
    (t) =>
      t.status === "in_progress" ||
      (t.start_date <= todayIso &&
        t.end_date >= todayIso &&
        t.status !== "done" &&
        t.status !== "blocked")
  );
  const blocked = tasks.filter((t) => t.status === "blocked");

  if (
    overdue.length === 0 &&
    startingSoon.length === 0 &&
    inProgress.length === 0 &&
    blocked.length === 0
  ) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Lookahead clear — nothing overdue or starting in this window.
      </p>
    );
  }

  function Row({
    title,
    items,
    tone,
  }: {
    title: string;
    items: ScheduleTask[];
    tone: "danger" | "warn" | "neutral";
  }) {
    if (!items.length) return null;
    return (
      <div className="space-y-2">
        <h3
          className={
            tone === "danger"
              ? "text-sm font-semibold text-destructive"
              : tone === "warn"
                ? "text-sm font-semibold text-amber-700"
                : "text-sm font-semibold"
          }
        >
          {title} ({items.length})
        </h3>
        <ul className="space-y-1">
          {items.slice(0, 8).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onSelect(t)}
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted disabled:opacity-100"
              >
                <span className="truncate font-medium">
                  {t.title}
                  {t.jobName ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {t.jobName}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatShort(t.start_date)}–{formatShort(t.end_date)} ·{" "}
                  {statusLabel(t.status)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="font-heading text-xl">Lookahead</h2>
        <p className="text-sm text-muted-foreground">
          Through {formatShort(horizonEnd)} — overdue, in progress, and upcoming.
        </p>
      </div>
      <Row title="Overdue" items={overdue} tone="danger" />
      <Row title="Blocked" items={blocked} tone="warn" />
      <Row title="In progress / on site" items={inProgress} tone="neutral" />
      <Row title="Starting soon" items={startingSoon} tone="neutral" />
    </section>
  );
}
