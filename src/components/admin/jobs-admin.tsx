"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { parseJobClients } from "@/types/estimates";
import type { Job, JobClient } from "@/types/logs";
import { cn } from "@/lib/utils";

type ClientOption = { id: string; full_name: string | null };

type Draft = { key: string; name: string; email: string; userId: string };

const emptyDraft = (): Draft => ({
  key: crypto.randomUUID(),
  name: "",
  email: "",
  userId: "",
});

export function JobsAdmin() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [portalUsers, setPortalUsers] = useState<ClientOption[]>([]);
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft[]>>({});
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const [jobsRes, clientsRes] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id, name, is_active, created_at, job_clients(id, job_id, full_name, email, client_user_id, sort_order)"
        )
        .order("name"),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "client")
        .eq("approval_status", "approved")
        .order("full_name"),
    ]);
    if (jobsRes.error) {
      setError(
        /job_clients|does not exist|schema cache/i.test(jobsRes.error.message)
          ? "Run supabase/migrations/0008_job_clients.sql in the SQL Editor to enable multiple clients per job."
          : jobsRes.error.message
      );
    } else {
      setJobs(
        (jobsRes.data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          is_active: row.is_active,
          created_at: row.created_at,
          clients: parseJobClients(row.job_clients),
        }))
      );
      setError(null);
    }
    setPortalUsers((clientsRes.data as ClientOption[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("jobs").insert({
      name: trimmed,
      is_active: true,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    await load();
  }

  async function patchJob(job: Job, partial: Partial<Job>) {
    const supabase = createClient();
    if (!supabase) return;
    const { error: updateError } = await supabase
      .from("jobs")
      .update(partial)
      .eq("id", job.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
  }

  async function saveJobName(job: Job) {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setError("Job name cannot be empty.");
      return;
    }
    if (trimmed === job.name) {
      setEditingNameId(null);
      return;
    }
    await patchJob(job, { name: trimmed });
    setEditingNameId(null);
  }

  function draftsFor(jobId: string) {
    return drafts[jobId] ?? [{ key: `${jobId}-first`, name: "", email: "", userId: "" }];
  }

  function setJobDrafts(jobId: string, next: Draft[]) {
    setDrafts((current) => ({ ...current, [jobId]: next }));
  }

  function patchDraft(jobId: string, key: string, partial: Partial<Draft>) {
    const current = draftsFor(jobId);
    setJobDrafts(
      jobId,
      current.map((draft) => (draft.key === key ? { ...draft, ...partial } : draft))
    );
  }

  async function saveNewClients(job: Job) {
    const ready = draftsFor(job.id).filter(
      (draft) => draft.name.trim() && draft.email.trim()
    );
    if (!ready.length) {
      setError("Add a client name and email before saving.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const startOrder = job.clients?.length ?? 0;
    const { error: insertError } = await supabase.from("job_clients").insert(
      ready.map((draft, index) => ({
        job_id: job.id,
        full_name: draft.name.trim(),
        email: draft.email.trim(),
        client_user_id: draft.userId || null,
        sort_order: startOrder + index,
      }))
    );
    if (insertError) {
      setError(
        /unique|duplicate/i.test(insertError.message)
          ? "That email is already on this job."
          : insertError.message
      );
      return;
    }
    setJobDrafts(job.id, [emptyDraft()]);
    setError(null);
    await load();
  }

  async function patchClient(client: JobClient, partial: Partial<JobClient>) {
    if (!client.id) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error: updateError } = await supabase
      .from("job_clients")
      .update(partial)
      .eq("id", client.id);
    if (updateError) {
      setError(
        /unique|duplicate/i.test(updateError.message)
          ? "That email is already on this job."
          : updateError.message
      );
      return;
    }
    setError(null);
    await load();
  }

  async function removeClient(client: JobClient) {
    if (!client.id) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error: deleteError } = await supabase
      .from("job_clients")
      .delete()
      .eq("id", client.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={addJob} className="space-y-3 rounded-lg border border-border p-4">
        <Label htmlFor="jobName">Add job site</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="jobName"
            className="min-h-11"
            placeholder="e.g. Downtown Clinic Remodel"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button type="submit" className="min-h-11 sm:w-auto" disabled={saving}>
            {saving ? "Adding…" : "Add job"}
          </Button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading jobs…</p>
      ) : (
        <ul className="space-y-4">
          {jobs.map((job) => {
            const newClients = draftsFor(job.id);
            return (
              <li key={job.id} className="space-y-4 rounded-lg border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    {editingNameId === job.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          className="min-h-11"
                          value={nameDraft}
                          aria-label="Job name"
                          autoFocus
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void saveJobName(job);
                            }
                            if (e.key === "Escape") setEditingNameId(null);
                          }}
                        />
                        <Button
                          type="button"
                          className="min-h-11"
                          onClick={() => void saveJobName(job)}
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => setEditingNameId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-heading text-2xl md:text-3xl">
                          {job.name}
                        </h2>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => {
                            setEditingNameId(job.id);
                            setNameDraft(job.name);
                          }}
                        >
                          Edit name
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-medium capitalize",
                        job.is_active ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {job.is_active ? "Active" : "Inactive"}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => void patchJob(job, { is_active: !job.is_active })}
                    >
                      {job.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Clients
                  </p>
                  {(job.clients ?? []).length ? (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {(job.clients ?? []).map((client) => (
                        <li
                          key={client.id ?? client.email}
                          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="font-medium">{client.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {client.email}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <select
                              className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm sm:w-48"
                              value={client.client_user_id ?? ""}
                              aria-label={`Portal user for ${client.full_name}`}
                              onChange={(e) =>
                                void patchClient(client, {
                                  client_user_id: e.target.value || null,
                                })
                              }
                            >
                              <option value="">No portal login</option>
                              {portalUsers.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.full_name?.trim() || "Client"}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11"
                              onClick={() => void removeClient(client)}
                            >
                              Remove
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No clients yet. Add the first contact below.
                    </p>
                  )}

                  <div className="space-y-3 rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">Add clients</p>
                    <p className="text-xs text-muted-foreground">
                      Start with one contact. Use “Add another client” for a
                      spouse or extra email.
                    </p>
                    {newClients.map((draft, index) => (
                      <div
                        key={draft.key}
                        className="grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2"
                      >
                        <p className="text-xs font-medium text-muted-foreground sm:col-span-2">
                          Client {index + 1}
                        </p>
                        <div className="space-y-1.5">
                          <Label htmlFor={`new-name-${job.id}-${draft.key}`}>
                            Name
                          </Label>
                          <Input
                            id={`new-name-${job.id}-${draft.key}`}
                            className="min-h-11"
                            placeholder="e.g. Jane Smith"
                            value={draft.name}
                            onChange={(e) =>
                              patchDraft(job.id, draft.key, { name: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`new-email-${job.id}-${draft.key}`}>
                            Email
                          </Label>
                          <Input
                            id={`new-email-${job.id}-${draft.key}`}
                            type="email"
                            className="min-h-11"
                            placeholder="jane@example.com"
                            value={draft.email}
                            onChange={(e) =>
                              patchDraft(job.id, draft.key, { email: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor={`new-user-${job.id}-${draft.key}`}>
                            Portal user (optional)
                          </Label>
                          <select
                            id={`new-user-${job.id}-${draft.key}`}
                            className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                            value={draft.userId}
                            onChange={(e) =>
                              patchDraft(job.id, draft.key, { userId: e.target.value })
                            }
                          >
                            <option value="">No portal login</option>
                            {portalUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.full_name?.trim() || "Client"}
                              </option>
                            ))}
                          </select>
                        </div>
                        {newClients.length > 1 ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 sm:col-span-2"
                            onClick={() =>
                              setJobDrafts(
                                job.id,
                                newClients.filter((item) => item.key !== draft.key)
                              )
                            }
                          >
                            Remove this form
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          setJobDrafts(job.id, [...newClients, emptyDraft()])
                        }
                      >
                        Add another client
                      </Button>
                      <Button
                        type="button"
                        className="min-h-11"
                        onClick={() => void saveNewClients(job)}
                      >
                        Save clients
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {!jobs.length ? (
            <li className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              No jobs yet. Add your first job site above.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
