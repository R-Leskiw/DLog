export type JobFolder = {
  id: string;
  job_id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
};

export type JobDocumentVersion = {
  id: string;
  document_id: string;
  version: number;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type JobDocument = {
  id: string;
  job_id: string;
  folder_id: string;
  display_name: string;
  current_version: number;
  created_at: string;
  updated_at: string;
  latest?: JobDocumentVersion | null;
};

export function formatBytes(n: number | null | undefined) {
  if (n == null || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPreviewableMime(mime: string | null | undefined) {
  if (!mime) return false;
  return mime === "application/pdf" || mime.startsWith("image/");
}
