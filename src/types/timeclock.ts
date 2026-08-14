export type TimeBreak = {
  id?: string;
  time_entry_id?: string;
  started_at: string;
  ended_at: string | null;
};

export type TimeEntry = {
  id: string;
  user_id: string;
  job_id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  jobName: string | null;
  breaks: TimeBreak[];
};

export type HoursRow = {
  userId: string;
  name: string;
  hours: number;
  openPunch: boolean;
  onBreak: boolean;
  byJob: { jobName: string; hours: number }[];
};

export function hoursBetween(
  clockIn: string,
  clockOut: string | null,
  nowMs = Date.now()
) {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : nowMs;
  return Math.max(0, (end - start) / 3_600_000);
}

export function breakHours(breaks: TimeBreak[], nowMs = Date.now()) {
  return breaks.reduce(
    (sum, b) => sum + hoursBetween(b.started_at, b.ended_at, nowMs),
    0
  );
}

export function paidHours(
  clockIn: string,
  clockOut: string | null,
  breaks: TimeBreak[],
  nowMs = Date.now()
) {
  return Math.max(
    0,
    hoursBetween(clockIn, clockOut, nowMs) - breakHours(breaks, nowMs)
  );
}

export function formatDuration(hours: number) {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = Math.abs(totalMin % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function formatDurationLabel(hours: number) {
  const totalMin = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (totalMin === 0) return "0 min";
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hr" : `${h} hr`;
  return `${h} hr ${m} min`;
}

export function formatPunchTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  return new Date(value).toISOString();
}

export function defaultShiftLocals(now = new Date()) {
  const start = new Date(now);
  start.setHours(7, 0, 0, 0);
  const end = new Date(now);
  end.setHours(15, 30, 0, 0);
  return {
    clockIn: toLocalInput(start.toISOString()),
    clockOut: toLocalInput(end.toISOString()),
  };
}
