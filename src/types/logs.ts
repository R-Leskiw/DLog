export type JobClient = {
  id?: string;
  job_id?: string;
  full_name: string;
  email: string;
  client_user_id: string | null;
  sort_order?: number;
};

export type Job = {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  clients?: JobClient[];
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
