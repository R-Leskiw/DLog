export const SCHEDULE_STATUSES = [
  "planned",
  "in_progress",
  "done",
  "blocked",
] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export type ScheduleStaff = {
  id: string;
  full_name: string | null;
};

export type ScheduleTask = {
  id: string;
  job_id: string | null;
  title: string;
  notes: string | null;
  start_date: string;
  end_date: string;
  status: ScheduleStatus;
  jobName: string | null;
  assigneeIds: string[];
};

export function statusLabel(status: ScheduleStatus) {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "done":
      return "Done";
    case "blocked":
      return "Blocked";
    default:
      return "Planned";
  }
}
