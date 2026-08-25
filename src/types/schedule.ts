export const SCHEDULE_STATUSES = [
  "planned",
  "in_progress",
  "done",
  "blocked",
] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const SCHEDULE_ZOOM_DAYS = [7, 14, 21, 30] as const;
export type ScheduleZoomDays = (typeof SCHEDULE_ZOOM_DAYS)[number];

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
  sort_order: number;
  jobName: string | null;
  assigneeIds: string[];
  /** Task IDs that must finish before this one starts (FS). */
  predecessorIds: string[];
};

export type ScheduleDependency = {
  id: string;
  predecessor_id: string;
  successor_id: string;
  lag_days: number;
};

export type ScheduleTemplate = {
  id: string;
  name: string;
  description: string | null;
};

export type ScheduleTemplateItem = {
  id: string;
  template_id: string;
  title: string;
  duration_days: number;
  lag_days: number;
  sort_order: number;
  notes: string | null;
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
