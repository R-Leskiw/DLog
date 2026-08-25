import { addDays, daysBetween, parseISODate, toISODate } from "@/lib/schedule/dates";

export type DepEdge = {
  predecessor_id: string;
  successor_id: string;
  lag_days: number;
};

export type DatedTask = {
  id: string;
  start_date: string;
  end_date: string;
};

/** Inclusive duration in days (start and end both count). */
export function taskDurationDays(start: string, end: string): number {
  return daysBetween(start, end) + 1;
}

export function shiftTaskDates(
  start: string,
  end: string,
  deltaDays: number
): { start_date: string; end_date: string } {
  return {
    start_date: toISODate(addDays(parseISODate(start), deltaDays)),
    end_date: toISODate(addDays(parseISODate(end), deltaDays)),
  };
}

/**
 * Finish-to-start: successor must start on/after predecessor end + 1 + lag.
 * Returns updated date map for any tasks that need to move (including cascaded).
 */
export function cascadeFinishToStart(
  tasks: DatedTask[],
  edges: DepEdge[],
  movedId: string,
  newStart: string,
  newEnd: string
): Map<string, { start_date: string; end_date: string }> {
  const byId = new Map(tasks.map((t) => [t.id, { ...t }]));
  const moved = byId.get(movedId);
  if (!moved) return new Map();

  moved.start_date = newStart;
  moved.end_date = newEnd;

  const outgoing = new Map<string, DepEdge[]>();
  for (const e of edges) {
    const list = outgoing.get(e.predecessor_id) ?? [];
    list.push(e);
    outgoing.set(e.predecessor_id, list);
  }

  const updates = new Map<string, { start_date: string; end_date: string }>();
  updates.set(movedId, { start_date: newStart, end_date: newEnd });

  const queue = [movedId];
  const seen = new Set<string>([movedId]);

  while (queue.length) {
    const predId = queue.shift()!;
    const pred = byId.get(predId);
    if (!pred) continue;

    for (const edge of outgoing.get(predId) ?? []) {
      const succ = byId.get(edge.successor_id);
      if (!succ) continue;

      const earliest = toISODate(
        addDays(parseISODate(pred.end_date), 1 + edge.lag_days)
      );
      if (succ.start_date >= earliest) {
        if (!seen.has(succ.id)) {
          seen.add(succ.id);
          queue.push(succ.id);
        }
        continue;
      }

      const duration = taskDurationDays(succ.start_date, succ.end_date);
      const nextStart = earliest;
      const nextEnd = toISODate(
        addDays(parseISODate(nextStart), duration - 1)
      );
      succ.start_date = nextStart;
      succ.end_date = nextEnd;
      updates.set(succ.id, { start_date: nextStart, end_date: nextEnd });

      if (!seen.has(succ.id)) {
        seen.add(succ.id);
        queue.push(succ.id);
      } else {
        queue.push(succ.id);
      }
    }
  }

  return updates;
}

/** Detect a cycle if adding predecessor → successor. */
export function wouldCreateCycle(
  edges: DepEdge[],
  predecessorId: string,
  successorId: string
): boolean {
  if (predecessorId === successorId) return true;
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    const list = outgoing.get(e.predecessor_id) ?? [];
    list.push(e.successor_id);
    outgoing.set(e.predecessor_id, list);
  }
  // Simulate the new edge
  const list = outgoing.get(predecessorId) ?? [];
  list.push(successorId);
  outgoing.set(predecessorId, list);

  const stack = [successorId];
  const visited = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === predecessorId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const next of outgoing.get(id) ?? []) stack.push(next);
  }
  return false;
}
