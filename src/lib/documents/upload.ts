import type { SupabaseClient } from "@supabase/supabase-js";
import imageCompression from "browser-image-compression";

import { JOB_DOCS_BUCKET } from "@/lib/documents/constants";

async function compressIfImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const out = (await imageCompression(file, {
    maxSizeMB: 1.5,
    maxWidthOrHeight: 2400,
    useWebWorker: true,
  })) as Blob | File;
  if (out instanceof File) return out;
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([out], `${base}.jpg`, {
    type: out.type || "image/jpeg",
  });
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type.startsWith("image/")) return "jpg";
  return "bin";
}

/**
 * Upload a file into a job folder. Same display name → new version.
 */
export async function uploadJobDocument(
  supabase: SupabaseClient,
  opts: {
    jobId: string;
    folderId: string;
    file: File;
    userId: string;
    displayName?: string;
  }
): Promise<{ error?: string }> {
  const file = await compressIfImage(opts.file);
  const displayName = (opts.displayName ?? opts.file.name).trim();
  if (!displayName) return { error: "File name is required." };

  const { data: existingRows, error: findError } = await supabase
    .from("job_documents")
    .select("id, current_version, display_name")
    .eq("folder_id", opts.folderId);

  if (findError) return { error: findError.message };

  const existing =
    (existingRows ?? []).find(
      (row) =>
        row.display_name.trim().toLowerCase() === displayName.toLowerCase()
    ) ?? null;

  const nextVersion = existing ? existing.current_version + 1 : 1;
  const ext = extensionFor(file);
  const documentId = existing?.id ?? crypto.randomUUID();
  const storagePath = `${opts.jobId}/${opts.folderId}/${documentId}/v${nextVersion}-${crypto.randomUUID()}.${ext}`;

  const { error: upError } = await supabase.storage
    .from(JOB_DOCS_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (upError) return { error: upError.message };

  if (existing) {
    const { error: updError } = await supabase
      .from("job_documents")
      .update({
        current_version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updError) return { error: updError.message };
  } else {
    const { error: insError } = await supabase.from("job_documents").insert({
      id: documentId,
      job_id: opts.jobId,
      folder_id: opts.folderId,
      display_name: displayName,
      current_version: 1,
      created_by: opts.userId,
    });
    if (insError) return { error: insError.message };
  }

  const { error: verError } = await supabase
    .from("job_document_versions")
    .insert({
      document_id: documentId,
      version: nextVersion,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_by: opts.userId,
    });
  if (verError) return { error: verError.message };

  return {};
}

export async function signedUrlForPath(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 3600
) {
  const { data, error } = await supabase.storage
    .from(JOB_DOCS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    return { url: null as string | null, error: error?.message ?? "No URL" };
  }
  return { url: data.signedUrl, error: undefined };
}
