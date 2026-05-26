import type { SupabaseClient } from "@supabase/supabase-js";
import imageCompression from "browser-image-compression";

import { LOG_IMAGES_BUCKET } from "@/lib/logs/constants";

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

async function compressIfImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }
  const out = (await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  })) as Blob | File;
  if (out instanceof File) {
    return out;
  }
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([out], `${base}.jpg`, {
    type: out.type || "image/jpeg",
  });
}

/**
 * Uploads compressed images to Supabase Storage and returns **public** URLs
 * (bucket should be public, or switch to signed URLs when displaying).
 */
export async function uploadLogImages(
  supabase: SupabaseClient,
  userId: string,
  files: File[]
): Promise<{ urls: string[]; error?: string }> {
  const urls: string[] = [];

  for (const raw of files) {
    const file = await compressIfImage(raw);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeExt = ALLOWED_EXT.has(ext) ? ext : "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${safeExt}`;
    const contentType =
      file.type && file.type.startsWith("image/")
        ? file.type
        : `image/${safeExt === "jpg" ? "jpeg" : safeExt}`;

    const { error } = await supabase.storage
      .from(LOG_IMAGES_BUCKET)
      .upload(path, file, {
        contentType,
        upsert: false,
      });

    if (error) {
      return {
        urls,
        error: error.message,
      };
    }

    const { data } = supabase.storage
      .from(LOG_IMAGES_BUCKET)
      .getPublicUrl(path);

    urls.push(data.publicUrl);
  }

  return { urls };
}
