export type FeedLog = {
  id: string;
  title: string | null;
  date: string;
  work_performed: string | null;
  image_urls: string[] | null;
  created_at: string;
  created_by: string | null;
  job: { id: string; name: string } | null;
  author: { full_name: string | null } | null;
};
