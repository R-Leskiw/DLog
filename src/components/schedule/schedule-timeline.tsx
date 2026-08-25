"use client";

import { useCallback, useState } from "react";

import { daysBetween, formatShort, formatWeekday } from "@/lib/schedule/dates";
import {
  statusLabel,
  type ScheduleStatus,
  type ScheduleTask,
} from "@/types/schedule";
import { cn } from "@/lib/utils";

function barClass(status: ScheduleStatus) {
  switch (status) {
    case "in_progress":
      return "bg-primary text-primary-foreground";
    case "done":
      return "bg-emerald-600 text-white";
    case "blocked":
      return "bg-destructive/90 text-destructive-foreground";
    default:
      return "bg-muted text-foreground";
  }
}

type DragMode = "move" | "resize-start" | "resize-end";

type DragState = {
  taskId: string;
  mode: DragMode;
  originX: number;
  startCol: number;
  span: number;
  dayWidth: number;
  moved: boolean;
};

export function ScheduleTimeline({
  tasks,
  days,
  rangeStart,
  rangeEnd,
  todayIso,
  canEdit,
  showJobName,
  nameFor,
  onSelect,
  onDatesChange,
}: {
  tasks: ScheduleTask[];
  days: string[];
  rangeStart: string;
  rangeEnd: string;
  todayIso: string;
  canEdit: boolean;
  showJobName: boolean;
  nameFor: (id: string) => string;
  onSelect: (task: ScheduleTask) => void;
  onDatesChange?: (
    task: ScheduleTask,
    start: string,
    end: string
  ) => void | Promise<void>;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<{
    taskId: string;
    startCol: number;
    span: number;
  } | null>(null);

  const windowDays = days.length;
  const todayCol =
    todayIso >= rangeStart && todayIso <= rangeEnd
      ? daysBetween(rangeStart, todayIso)
      : null;

  const applyPointer = useCallback(
    (clientX: number, state: DragState) => {
      const deltaPx = clientX - state.originX;
      const deltaCols = Math.round(deltaPx / state.dayWidth);
      const moved = Math.abs(deltaPx) > 4;
      let startCol = state.startCol;
      let span = state.span;

      if (state.mode === "move") {
        startCol = Math.max(
          0,
          Math.min(windowDays - state.span, state.startCol + deltaCols)
        );
      } else if (state.mode === "resize-start") {
        const newStart = Math.max(
          0,
          Math.min(state.startCol + state.span - 1, state.startCol + deltaCols)
        );
        span = state.startCol + state.span - newStart;
        startCol = newStart;
      } else {
        span = Math.max(1, state.span + deltaCols);
        if (startCol + span > windowDays) span = windowDays - startCol;
      }

      setDrag({ ...state, moved: state.moved || moved });
      setPreview({ taskId: state.taskId, startCol, span });
    },
    [windowDays]
  );

  function beginDrag(
    e: React.PointerEvent,
    task: ScheduleTask,
    mode: DragMode,
    startCol: number,
    span: number,
    trackEl: HTMLElement
  ) {
    if (!canEdit || !onDatesChange) return;
    e.preventDefault();
    e.stopPropagation();
    const dayWidth = trackEl.getBoundingClientRect().width / windowDays;
    if (!dayWidth) return;
    const state: DragState = {
      taskId: task.id,
      mode,
      originX: e.clientX,
      startCol,
      span,
      dayWidth,
      moved: false,
    };
    setDrag(state);
    setPreview({ taskId: task.id, startCol, span });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  async function endDrag(task: ScheduleTask) {
    if (!drag || drag.taskId !== task.id) {
      setDrag(null);
      setPreview(null);
      return;
    }
    const wasMoved = drag.moved;
    const next = preview;
    setDrag(null);
    setPreview(null);

    if (!wasMoved && drag.mode === "move") {
      onSelect(task);
      return;
    }
    if (!next || !onDatesChange) return;
    const start = days[next.startCol];
    const end = days[next.startCol + next.span - 1];
    if (!start || !end) return;
    if (start === task.start_date && end === task.end_date) return;
    await onDatesChange(task, start, end);
  }

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tasks in this date range.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onSelect(task)}
              className={cn(
                "w-full rounded-xl border border-border bg-card p-4 text-left",
                canEdit && "min-h-11"
              )}
            >
              <p className="font-semibold">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                {showJobName ? `${task.jobName || "Unassigned"} · ` : ""}
                {statusLabel(task.status)}
                {task.predecessorIds.length
                  ? ` · ${task.predecessorIds.length} predecessor${task.predecessorIds.length === 1 ? "" : "s"}`
                  : ""}
              </p>
              <p className="mt-1 text-sm">
                {formatShort(task.start_date)} – {formatShort(task.end_date)}
              </p>
              {task.assigneeIds.length ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.assigneeIds.map(nameFor).join(", ")}
                </p>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <div
          className="min-w-[720px]"
          style={{ minWidth: `${Math.max(720, windowDays * 40 + 160)}px` }}
        >
          <div
            className="grid border-b border-border pb-2"
            style={{
              gridTemplateColumns: `10rem repeat(${windowDays}, minmax(2.25rem, 1fr))`,
            }}
          >
            <div />
            {days.map((d) => (
              <div
                key={d}
                className={cn(
                  "text-center text-[0.65rem] leading-tight",
                  d === todayIso && "font-semibold text-primary"
                )}
              >
                <div>{formatWeekday(d)}</div>
                <div>{formatShort(d).split(" ")[1]}</div>
              </div>
            ))}
          </div>
          <ul className="divide-y divide-border">
            {tasks.map((task) => {
              const clippedStart =
                task.start_date < rangeStart ? rangeStart : task.start_date;
              const clippedEnd =
                task.end_date > rangeEnd ? rangeEnd : task.end_date;
              const baseStartCol = daysBetween(rangeStart, clippedStart);
              const baseSpan = daysBetween(clippedStart, clippedEnd) + 1;
              const isPreview = preview?.taskId === task.id;
              const colStart = isPreview ? preview.startCol : baseStartCol;
              const span = isPreview ? preview.span : baseSpan;
              const inRange =
                task.end_date >= rangeStart && task.start_date <= rangeEnd;

              return (
                <li
                  key={task.id}
                  className="grid items-center py-2"
                  style={{
                    gridTemplateColumns: `10rem repeat(${windowDays}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="pr-2">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    {showJobName ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {task.jobName || "Unassigned"}
                      </p>
                    ) : null}
                    {task.predecessorIds.length ? (
                      <p className="truncate text-[0.65rem] text-muted-foreground">
                        After {task.predecessorIds.length} task
                        {task.predecessorIds.length === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className="relative grid h-10"
                    style={{
                      gridColumn: "2 / -1",
                      gridTemplateColumns: `repeat(${windowDays}, minmax(0, 1fr))`,
                    }}
                    onPointerMove={(e) => {
                      if (drag?.taskId === task.id) applyPointer(e.clientX, drag);
                    }}
                    onPointerUp={() => {
                      if (drag?.taskId === task.id) void endDrag(task);
                    }}
                    onPointerCancel={() => {
                      setDrag(null);
                      setPreview(null);
                    }}
                  >
                    {todayCol !== null ? (
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-primary"
                        style={{
                          left: `calc(${(todayCol / windowDays) * 100}% + ${100 / windowDays / 2}%)`,
                        }}
                      />
                    ) : null}
                    {inRange ? (
                      <div
                        className="relative z-[1] flex min-h-10"
                        style={{
                          gridColumn: `${colStart + 1} / span ${Math.max(span, 1)}`,
                        }}
                      >
                        {canEdit && onDatesChange ? (
                          <button
                            type="button"
                            aria-label="Resize start"
                            className="absolute inset-y-0 left-0 z-20 w-3 cursor-ew-resize rounded-l-md"
                            onPointerDown={(e) =>
                              beginDrag(
                                e,
                                task,
                                "resize-start",
                                baseStartCol,
                                baseSpan,
                                e.currentTarget.parentElement?.parentElement as HTMLElement
                              )
                            }
                          />
                        ) : null}
                        <button
                          type="button"
                          disabled={!canEdit}
                          onPointerDown={(e) => {
                            if (canEdit && onDatesChange) {
                              beginDrag(
                                e,
                                task,
                                "move",
                                baseStartCol,
                                baseSpan,
                                e.currentTarget.parentElement?.parentElement as HTMLElement
                              );
                            }
                          }}
                          onClick={() => {
                            if (!canEdit || !onDatesChange) onSelect(task);
                          }}
                          className={cn(
                            "min-h-10 w-full truncate rounded-md px-2 text-left text-xs font-medium",
                            canEdit && onDatesChange && "cursor-grab active:cursor-grabbing",
                            barClass(task.status)
                          )}
                        >
                          {statusLabel(task.status)}
                          {task.assigneeIds.length
                            ? ` · ${task.assigneeIds.map(nameFor).join(", ")}`
                            : ""}
                        </button>
                        {canEdit && onDatesChange ? (
                          <button
                            type="button"
                            aria-label="Resize end"
                            className="absolute inset-y-0 right-0 z-20 w-3 cursor-ew-resize rounded-r-md"
                            onPointerDown={(e) =>
                              beginDrag(
                                e,
                                task,
                                "resize-end",
                                baseStartCol,
                                baseSpan,
                                e.currentTarget.parentElement?.parentElement as HTMLElement
                              )
                            }
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
