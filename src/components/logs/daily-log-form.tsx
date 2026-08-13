"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { uploadLogImages } from "@/lib/logs/upload-log-images";
import type { Job } from "@/types/logs";
import { cn } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1, "Add a title").max(200),
  jobId: z.string().min(1, "Select a job"),
  workPerformed: z
    .string()
    .min(1, "Describe the work")
    .max(16_000, "Description is too long"),
  logDate: z.string().min(1, "Pick a date"),
});

type FormValues = z.infer<typeof schema>;

const MAX_PHOTOS = 10;
const MAX_FILE_MB = 12;

export function DailyLogForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadJobsError, setLoadJobsError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const previewUrls = useMemo(
    () => photos.map((p) => URL.createObjectURL(p)),
    [photos]
  );

  useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previewUrls]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      jobId: "",
      workPerformed: "",
      logDate: today,
    },
  });

  useEffect(() => {
    if (!supabase) {
      setUser(null);
      setLoadJobsError("Add Supabase URL and anon key to .env.local.");
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id,name,is_active")
        .eq("is_active", true)
        .order("name");
      if (cancelled) return;
      if (error) {
        setLoadJobsError(error.message);
        return;
      }
      setJobs((data as Job[]) ?? []);
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const addPhotos = useCallback((list: FileList | null) => {
    if (!list?.length) return;
    setPhotos((prev) => {
      const next = [...prev];
      for (let i = 0; i < list.length; i++) {
        const f = list.item(i);
        if (!f || !f.type.startsWith("image/")) continue;
        if (f.size > MAX_FILE_MB * 1024 * 1024) continue;
        if (next.length >= MAX_PHOTOS) break;
        const dup = next.some((p) => p.name === f.name && p.size === f.size);
        if (dup) continue;
        next.push(f);
      }
      return next;
    });
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    const sb = createClient();
    if (!sb) {
      setSubmitError("Supabase is not configured (.env.local).");
      return;
    }

    const {
      data: { user: u },
    } = await sb.auth.getUser();
    if (!u) {
      setSubmitError("You need to be signed in to submit a log.");
      return;
    }

    setUploading(true);
    try {
      const { urls, error: upErr } = await uploadLogImages(sb, u.id, photos);
      if (upErr) {
        setSubmitError(`Upload failed: ${upErr}`);
        return;
      }

      const { error: insErr } = await sb
        .from("daily_logs")
        .insert({
          title: values.title,
          job_id: values.jobId,
          work_performed: values.workPerformed,
          date: values.logDate,
          image_urls: urls.length ? urls : null,
          created_by: u.id,
        })
        .select("id")
        .maybeSingle();

      if (insErr) {
        const msg =
          insErr.code === "42501" || /row-level security/i.test(insErr.message)
            ? `${insErr.message} (Approved employees/admins need a matching profile role.)`
            : insErr.message;
        setSubmitError(msg);
        return;
      }

      router.push("/logs");
      router.refresh();
    } finally {
      setUploading(false);
    }
  };

  const signedIn = user !== undefined && user !== null;
  const authLoading = user === undefined;

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">New daily log</CardTitle>
        <CardDescription>
          Title, job, description, and site photos. Fields match your spec;
          description is saved as work performed.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
        {!supabase && (
          <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Set{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              .env.local
            </code>
            .
          </p>
        )}

        {supabase && !authLoading && !user && (
          <p className="mb-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <Link href="/login" className="font-medium text-primary underline">
              Sign in
            </Link>{" "}
            to submit a log. Only employees (profile role) can create logs once
            RLS is enabled.
          </p>
        )}

        {loadJobsError && (
          <p className="mb-4 text-sm text-destructive">
            Could not load jobs: {loadJobsError}
          </p>
        )}

        {submitError && (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {submitError}
          </p>
        )}

          <FieldSet className="gap-6">
            <FieldGroup>
              <Field data-invalid={!!errors.logDate}>
                <FieldLabel htmlFor="log-date">Log date</FieldLabel>
                <FieldContent>
                  <Input
                    id="log-date"
                    type="date"
                    className="min-h-11 max-w-xs"
                    aria-invalid={!!errors.logDate}
                    {...register("logDate")}
                  />
                  <FieldDescription>Defaults to today; adjust for catch-up.</FieldDescription>
                  <FieldError errors={[errors.logDate]} />
                </FieldContent>
              </Field>

              <Field data-invalid={!!errors.title}>
                <FieldLabel htmlFor="log-title">Title</FieldLabel>
                <FieldContent>
                  <Input
                    id="log-title"
                    placeholder="e.g. Slab pour — west wing"
                    className="min-h-11"
                    aria-invalid={!!errors.title}
                    {...register("title")}
                  />
                  <FieldError errors={[errors.title]} />
                </FieldContent>
              </Field>

              <Field data-invalid={!!errors.jobId}>
                <FieldLabel>Job</FieldLabel>
                <FieldContent>
                  <Controller
                    name="jobId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || null}
                        onValueChange={(v) => field.onChange(v ?? "")}
                        disabled={!jobs.length}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-full min-h-11 py-2.5",
                            "data-[size=default]:h-11"
                          )}
                          size="default"
                          id="log-job"
                          aria-invalid={!!errors.jobId}
                        >
                          <SelectValue placeholder="Select a job" />
                        </SelectTrigger>
                        <SelectContent>
                          {jobs.map((job) => (
                            <SelectItem key={job.id} value={job.id}>
                              {job.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldDescription>
                    Which site or contract this entry applies to.
                  </FieldDescription>
                  <FieldError errors={[errors.jobId]} />
                </FieldContent>
              </Field>

              <Field data-invalid={!!errors.workPerformed}>
                <FieldLabel htmlFor="log-description">Description</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="log-description"
                    placeholder="Work performed, materials, visitors, safety notes…"
                    rows={8}
                    className="min-h-44 resize-y text-base md:text-sm"
                    aria-invalid={!!errors.workPerformed}
                    {...register("workPerformed")}
                  />
                  <FieldError errors={[errors.workPerformed]} />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>Photos</FieldLabel>
                <FieldContent className="gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      addPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="min-h-11 gap-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="size-5" aria-hidden />
                      Add photo
                    </Button>
                    <span className="self-center text-xs text-muted-foreground">
                      Up to {MAX_PHOTOS} images, {MAX_FILE_MB}MB each (compressed
                      before upload).
                    </span>
                  </div>
                  {previewUrls.length > 0 && (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {previewUrls.map((url, index) => (
                        <li
                          key={url}
                          className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt=""
                            className="size-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute right-1 top-1 size-9 min-h-9 min-w-9 rounded-full shadow-md"
                            onClick={() => removePhoto(index)}
                            aria-label={`Remove photo ${index + 1}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </FieldContent>
              </Field>
            </FieldGroup>
          </FieldSet>
        </CardContent>

        <CardFooter className="flex-col gap-3 border-t border-border sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              className="min-h-11 w-full min-w-44 sm:w-auto"
              disabled={
                uploading ||
                authLoading ||
                !signedIn ||
                !supabase ||
                !jobs.length
              }
            >
              {uploading ? "Saving…" : "Submit log"}
            </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
