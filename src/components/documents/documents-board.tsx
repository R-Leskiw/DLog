"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, FolderPlus, Upload } from "lucide-react";

import { PageTrail } from "@/components/layout/page-breadcrumbs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signedUrlForPath,
  uploadJobDocument,
} from "@/lib/documents/upload";
import { createClient } from "@/lib/supabase/client";
import {
  formatBytes,
  isPreviewableMime,
  type JobDocument,
  type JobDocumentVersion,
  type JobFolder,
} from "@/types/documents";
import type { Job } from "@/types/logs";
import { cn } from "@/lib/utils";

function isMissingRelation(message: string | undefined) {
  if (!message) return false;
  return /does not exist|schema cache/i.test(message);
}

export function DocumentsBoard({ canManageFolders }: { canManageFolders: boolean }) {
  return (
    <Suspense
      fallback={
        <main className="px-4 py-6 text-sm text-muted-foreground">
          Loading documents…
        </main>
      }
    >
      <DocumentsBoardInner canManageFolders={canManageFolders} />
    </Suspense>
  );
}

function DocumentsBoardInner({
  canManageFolders,
}: {
  canManageFolders: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const jobFilter = searchParams.get("job") || "all";
  const fromJob = searchParams.get("from") === "job";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [folders, setFolders] = useState<JobFolder[]>([]);
  const [documents, setDocuments] = useState<JobDocument[]>([]);
  const [versions, setVersions] = useState<JobDocumentVersion[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);

  const selectedJob = jobs.find((j) => j.id === jobFilter) ?? null;
  const isAllJobs = jobFilter === "all";

  const setJobFilter = useCallback(
    (id: string) => {
      if (fromJob && id === "all") {
        router.push("/jobs");
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (id === "all") {
        params.delete("job");
        params.delete("from");
      } else {
        params.set("job", id);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [fromJob, pathname, router, searchParams]
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const jobsRes = await supabase
      .from("jobs")
      .select("id, name, is_active")
      .order("name");
    if (jobsRes.error) {
      setError(jobsRes.error.message);
      setLoading(false);
      return;
    }
    setJobs((jobsRes.data as Job[]) ?? []);

    if (jobFilter === "all") {
      setFolders([]);
      setDocuments([]);
      setVersions([]);
      setSelectedFolderId(null);
      setSelectedDocId(null);
      setSchemaReady(true);
      setLoading(false);
      setError(null);
      return;
    }

    const foldersRes = await supabase
      .from("job_folders")
      .select("id, job_id, name, sort_order, is_default")
      .eq("job_id", jobFilter)
      .order("sort_order")
      .order("name");

    if (foldersRes.error && isMissingRelation(foldersRes.error.message)) {
      setSchemaReady(false);
      setError(null);
      setLoading(false);
      return;
    }
    setSchemaReady(true);

    if (foldersRes.error) {
      setError(foldersRes.error.message);
      setLoading(false);
      return;
    }

    const folderRows = (foldersRes.data as JobFolder[]) ?? [];
    setFolders(folderRows);

    const folderIds = folderRows.map((f) => f.id);
    if (!folderIds.length) {
      setDocuments([]);
      setVersions([]);
      setSelectedFolderId(null);
      setLoading(false);
      return;
    }

    const docsRes = await supabase
      .from("job_documents")
      .select(
        "id, job_id, folder_id, display_name, current_version, created_at, updated_at"
      )
      .in("folder_id", folderIds)
      .order("display_name");

    if (docsRes.error) {
      setError(docsRes.error.message);
      setLoading(false);
      return;
    }

    const docRows = (docsRes.data as JobDocument[]) ?? [];
    const docIds = docRows.map((d) => d.id);
    let versionRows: JobDocumentVersion[] = [];
    if (docIds.length) {
      const verRes = await supabase
        .from("job_document_versions")
        .select(
          "id, document_id, version, storage_path, mime_type, file_size, uploaded_by, created_at"
        )
        .in("document_id", docIds)
        .order("version", { ascending: false });
      if (verRes.error) {
        setError(verRes.error.message);
        setLoading(false);
        return;
      }
      versionRows = (verRes.data as JobDocumentVersion[]) ?? [];
    }

    const latestByDoc = new Map<string, JobDocumentVersion>();
    for (const v of versionRows) {
      if (!latestByDoc.has(v.document_id)) latestByDoc.set(v.document_id, v);
    }

    setDocuments(
      docRows.map((d) => ({
        ...d,
        latest: latestByDoc.get(d.id) ?? null,
      }))
    );
    setVersions(versionRows);
    setSelectedFolderId((prev) =>
      prev && folderRows.some((f) => f.id === prev)
        ? prev
        : folderRows[0]?.id ?? null
    );
    setError(null);
    setLoading(false);
  }, [jobFilter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const selectedFolder =
    folders.find((f) => f.id === selectedFolderId) ?? null;
  const folderDocs = useMemo(
    () =>
      documents.filter((d) => d.folder_id === selectedFolderId).sort((a, b) =>
        a.display_name.localeCompare(b.display_name)
      ),
    [documents, selectedFolderId]
  );
  const selectedDoc =
    folderDocs.find((d) => d.id === selectedDocId) ?? folderDocs[0] ?? null;
  const docVersions = useMemo(
    () =>
      selectedDoc
        ? versions
            .filter((v) => v.document_id === selectedDoc.id)
            .sort((a, b) => b.version - a.version)
        : [],
    [selectedDoc, versions]
  );

  useEffect(() => {
    setSelectedDocId(selectedDoc?.id ?? null);
  }, [selectedFolderId, selectedDoc?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      setPreviewUrl(null);
      const latest = selectedDoc?.latest;
      if (!latest || !isPreviewableMime(latest.mime_type)) return;
      const supabase = createClient();
      if (!supabase) return;
      const { url } = await signedUrlForPath(supabase, latest.storage_path);
      if (!cancelled) setPreviewUrl(url);
    }
    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [selectedDoc?.id, selectedDoc?.latest?.storage_path, selectedDoc?.latest?.mime_type]);

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageFolders || !selectedJob) return;
    const name = newFolderName.trim();
    if (!name) return;
    const supabase = createClient();
    if (!supabase) return;
    const maxOrder = folders.reduce((m, f) => Math.max(m, f.sort_order), 0);
    const { error: insError } = await supabase.from("job_folders").insert({
      job_id: selectedJob.id,
      name,
      sort_order: maxOrder + 10,
      is_default: false,
    });
    if (insError) {
      setError(insError.message);
      return;
    }
    setNewFolderName("");
    await load();
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length || !selectedJob || !selectedFolder) return;
    const supabase = createClient();
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be signed in to upload.");
      return;
    }
    setUploading(true);
    setError(null);
    for (const file of Array.from(files)) {
      const { error: upError } = await uploadJobDocument(supabase, {
        jobId: selectedJob.id,
        folderId: selectedFolder.id,
        file,
        userId: user.id,
      });
      if (upError) {
        setError(upError);
        break;
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await load();
  }

  async function openVersion(version: JobDocumentVersion) {
    const supabase = createClient();
    if (!supabase) return;
    const { url, error: urlError } = await signedUrlForPath(
      supabase,
      version.storage_path
    );
    if (urlError || !url) {
      setError(urlError ?? "Could not open file.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const heading = isAllJobs
    ? "Documents"
    : selectedJob?.name ?? "Job documents";

  const crumbs = isAllJobs
    ? [{ label: "Documents" }]
    : fromJob
      ? [
          { label: "Jobs", href: "/jobs" },
          {
            label: selectedJob?.name ?? "Job",
            href: `/jobs/${jobFilter}`,
          },
          { label: "Documents" },
        ]
      : [
          { label: "Documents", href: "/documents" },
          { label: selectedJob?.name ?? "Job" },
        ];

  const trailFallback = fromJob && !isAllJobs
    ? `/jobs/${jobFilter}`
    : isAllJobs
      ? "/dashboard"
      : "/documents";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageTrail items={crumbs} fallbackHref={trailFallback} />
          <h1 className="font-heading text-3xl md:text-4xl">{heading}</h1>
          <p className="mt-1 text-muted-foreground">
            {isAllJobs
              ? "Open a job to browse Plans, Permits, Photos, and custom folders."
              : "Upload files into a folder. Same name creates a new version."}
          </p>
        </div>
      </header>

      {!schemaReady ? (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Run{" "}
          <code className="rounded bg-muted px-1 text-xs">
            supabase/migrations/0010_job_documents.sql
          </code>{" "}
          in the Supabase SQL Editor to enable documents.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="min-w-[12rem] max-w-sm space-y-1.5">
        <Label htmlFor="docs-job">Job</Label>
        <select
          id="docs-job"
          className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
        >
          <option value="all">All jobs</option>
          {jobs
            .filter((j) => j.is_active || j.id === jobFilter)
            .map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isAllJobs ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jobs
            .filter((j) => j.is_active)
            .map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => setJobFilter(job.id)}
                className="min-h-11 rounded-lg border border-border bg-card px-4 py-4 text-left transition-colors hover:bg-muted/50"
              >
                <p className="font-heading text-lg">{job.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Open document library
                </p>
              </button>
            ))}
          {jobs.filter((j) => j.is_active).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active jobs. Add one in Admin → Jobs.
            </p>
          ) : null}
        </section>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <aside className="w-full shrink-0 space-y-3 lg:w-64">
            <h2 className="font-heading text-xl">Folders</h2>
            <ul className="space-y-1">
              {folders.map((folder) => {
                const count = documents.filter(
                  (d) => d.folder_id === folder.id
                ).length;
                const active = folder.id === selectedFolderId;
                return (
                  <li key={folder.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(folder.id)}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="truncate font-medium">{folder.name}</span>
                      <span
                        className={cn(
                          "text-xs",
                          active
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {canManageFolders ? (
              <form onSubmit={addFolder} className="space-y-2 border-t border-border pt-3">
                <Label htmlFor="new-folder">Add folder</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-folder"
                    className="min-h-11"
                    placeholder="Folder name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="min-h-11 shrink-0 gap-1"
                    disabled={!newFolderName.trim()}
                  >
                    <FolderPlus className="size-4" aria-hidden />
                    Add
                  </Button>
                </div>
              </form>
            ) : null}
          </aside>

          <section className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-heading text-xl">
                {selectedFolder?.name ?? "Files"}
              </h2>
              {selectedFolder ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    multiple
                    accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => void onUpload(e.target.files)}
                  />
                  <button
                    type="button"
                    className={cn(
                      buttonVariants(),
                      "min-h-11 gap-2"
                    )}
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-4" aria-hidden />
                    {uploading ? "Uploading…" : "Upload files"}
                  </button>
                </>
              ) : null}
            </div>

            {folderDocs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No files in this folder yet. Upload a PDF or photo to get
                started.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {folderDocs.map((doc) => {
                    const active = doc.id === selectedDoc?.id;
                    return (
                      <li key={doc.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedDocId(doc.id)}
                          className={cn(
                            "flex min-h-11 w-full items-start gap-3 px-3 py-3 text-left",
                            active ? "bg-primary/15" : "hover:bg-muted/60"
                          )}
                        >
                          <FileText
                            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {doc.display_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              v{doc.current_version}
                              {doc.latest
                                ? ` · ${formatBytes(doc.latest.file_size)}`
                                : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {selectedDoc ? (
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <div>
                      <h3 className="font-heading text-lg">
                        {selectedDoc.display_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Current version v{selectedDoc.current_version}
                      </p>
                    </div>

                    {previewUrl &&
                    isPreviewableMime(selectedDoc.latest?.mime_type) ? (
                      selectedDoc.latest?.mime_type?.startsWith("image/") ? (
                        <img
                          src={previewUrl}
                          alt={selectedDoc.display_name}
                          className="max-h-80 w-full rounded-md object-contain bg-muted"
                        />
                      ) : (
                        <iframe
                          title={selectedDoc.display_name}
                          src={previewUrl}
                          className="h-80 w-full rounded-md border border-border bg-muted"
                        />
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Preview not available for this file type. Open a version
                        below.
                      </p>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Versions</h4>
                      <ul className="space-y-1">
                        {docVersions.map((v) => (
                          <li key={v.id}>
                            <button
                              type="button"
                              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted"
                              onClick={() => void openVersion(v)}
                            >
                              <span>
                                v{v.version}
                                <span className="text-muted-foreground">
                                  {" "}
                                  ·{" "}
                                  {new Date(v.created_at).toLocaleString()}
                                </span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatBytes(v.file_size)} · Open
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
