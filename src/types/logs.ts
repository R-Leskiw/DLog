export type Job = {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
};

export type DailyLogInsert = {
  title: string;
  job_id: string | null;
  work_performed: string;
  date: string;
  weather?: string | null;
  crew_on_site?: string | null;
  issues_delays?: string | null;
  image_urls: string[] | null;
  created_by: string;
};
