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

type Draft = { name: string; email: string; userId: string };

const emptyDraft = (): Draft => ({ name: "", email: "", userId: "" });

export function JobsAdmin() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [portalUsers, setPortalUsers] = useState<ClientOption[]>([]);
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
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

  async function addClient(job: Job) {
    const draft = drafts[job.id] ?? emptyDraft();
    const fullName = draft.name.trim();
    const email = draft.email.trim();
    if (!fullName || !email) {
      setError("Each client needs a name and email.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    const nextOrder = (job.clients?.length ?? 0);
    const { error: insertError } = await supabase.from("job_clients").insert({
      job_id: job.id,
      full_name: fullName,
      email,
      client_user_id: draft.userId || null,
      sort_order: nextOrder,
    });
    if (insertError) {
      setError(
        /unique|duplicate/i.test(insertError.message)
          ? "That email is already on this job."
          : insertError.message
      );
      return;
    }
    setDrafts((current) => ({ ...current, [job.id]: emptyDraft() }));
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
            const draft = drafts[job.id] ?? emptyDraft();
            return (
              <li key={job.id} className="space-y-4 rounded-lg border border-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Input
                    className="min-h-11"
                    defaultValue={job.name}
                    aria-label={`Name for ${job.name}`}
                    onBlur={(e) => {
                      const next = e.target.value.trim();
                      if (next && next !== job.name) {
                        void patchJob(job, { name: next });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  <div className="flex items-center gap-2">
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
                  <h3 className="font-heading text-lg">Clients</h3>
                  <p className="text-xs text-muted-foreground">
                    Add everyone who should receive estimates — typically both
                    spouses. Each email gets the same share link.
                  </p>
                  {(job.clients ?? []).map((client) => (
                    <div
                      key={client.id ?? client.email}
                      className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"
                    >
                      <div className="space-y-1.5">
                        <Label>Name</Label>
                        <Input
                          className="min-h-11"
                          defaultValue={client.full_name}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next && next !== client.full_name) {
                              void patchClient(client, { full_name: next });
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          className="min-h-11"
                          defaultValue={client.email}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next && next !== client.email) {
                              void patchClient(client, { email: next });
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Portal user (optional)</Label>
                        <select
                          className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                          value={client.client_user_id ?? ""}
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
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 sm:col-span-2"
                        onClick={() => void removeClient(client)}
                      >
                        Remove client
                      </Button>
                    </div>
                  ))}

                  <div className="grid gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`new-name-${job.id}`}>Add client name</Label>
                      <Input
                        id={`new-name-${job.id}`}
                        className="min-h-11"
                        placeholder="e.g. Jane Smith"
                        value={draft.name}
                        onChange={(e) =>
                          setDrafts((current) => ({
                            ...current,
                            [job.id]: { ...draft, name: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`new-email-${job.id}`}>Email</Label>
                      <Input
                        id={`new-email-${job.id}`}
                        type="email"
                        className="min-h-11"
                        placeholder="jane@example.com"
                        value={draft.email}
                        onChange={(e) =>
                          setDrafts((current) => ({
                            ...current,
                            [job.id]: { ...draft, email: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`new-user-${job.id}`}>
                        Portal user (optional)
                      </Label>
                      <select
                        id={`new-user-${job.id}`}
                        className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        value={draft.userId}
                        onChange={(e) =>
                          setDrafts((current) => ({
                            ...current,
                            [job.id]: { ...draft, userId: e.target.value },
                          }))
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
                    <Button
                      type="button"
                      className="min-h-11 sm:col-span-2"
                      onClick={() => void addClient(job)}
                    >
                      Add client
                    </Button>
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
