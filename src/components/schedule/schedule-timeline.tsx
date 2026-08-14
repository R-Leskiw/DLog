import { daysBetween, formatShort, formatWeekday } from "@/lib/schedule/dates";
import { statusLabel, type ScheduleStatus, type ScheduleTask } from "@/types/schedule";
import { cn } from "@/lib/utils";

const WINDOW_DAYS = 14;

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
}) {
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
        <div className="min-w-[720px]">
          <div
            className="grid border-b border-border pb-2"
            style={{
              gridTemplateColumns: `10rem repeat(${WINDOW_DAYS}, minmax(2.5rem, 1fr))`,
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
              const colStart = daysBetween(rangeStart, clippedStart);
              const span = daysBetween(clippedStart, clippedEnd) + 1;
              return (
                <li
                  key={task.id}
                  className="grid items-center py-2"
                  style={{
                    gridTemplateColumns: `10rem repeat(${WINDOW_DAYS}, minmax(2.5rem, 1fr))`,
                  }}
                >
                  <div className="pr-2">
                    <p className="truncate text-sm font-medium">{task.title}</p>
                    {showJobName ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {task.jobName || "Unassigned"}
                      </p>
                    ) : null}
                  </div>
                  <div
                    className="relative grid h-10"
                    style={{
                      gridColumn: "2 / -1",
                      gridTemplateColumns: `repeat(${WINDOW_DAYS}, minmax(0, 1fr))`,
                    }}
                  >
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => onSelect(task)}
                      className={cn(
                        "min-h-10 truncate rounded-md px-2 text-left text-xs font-medium",
                        barClass(task.status)
                      )}
                      style={{
                        gridColumn: `${colStart + 1} / span ${Math.max(span, 1)}`,
                      }}
                    >
                      {statusLabel(task.status)}
                      {task.assigneeIds.length
                        ? ` · ${task.assigneeIds.map(nameFor).join(", ")}`
                        : ""}
                    </button>
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

export { WINDOW_DAYS };
