"use client";

import { useCallback, useEffect, useState } from "react";

import { FeedCard } from "@/components/feed/feed-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { FeedLog } from "@/types/feed";

const PAGE_SIZE = 10;

type LogRow = {
  id: string;
  title: string | null;
  date: string;
  work_performed: string | null;
  image_urls: string[] | null;
  created_at: string;
  created_by: string | null;
  jobs: { id: string; name: string } | { id: string; name: string }[] | null;
};

export function Feed() {
  const [logs, setLogs] = useState<FeedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("daily_logs")
      .select(
        "id, title, date, work_performed, image_urls, created_at, created_by, jobs(id, name)"
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    const rows = (data ?? []) as LogRow[];
    const authorIds = [
      ...new Set(rows.map((r) => r.created_by).filter(Boolean)),
    ] as string[];

    const nameById = new Map<string, string | null>();
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      for (const p of profiles ?? []) {
        nameById.set(p.id, p.full_name);
      }
    }

    const mapped: FeedLog[] = rows.map((row) => {
      const jobRaw = row.jobs;
      const job = Array.isArray(jobRaw) ? jobRaw[0] ?? null : jobRaw;
      return {
        id: row.id,
        title: row.title,
        date: row.date,
        work_performed: row.work_performed,
        image_urls: row.image_urls,
        created_at: row.created_at,
        created_by: row.created_by,
        job: job ? { id: job.id, name: job.name } : null,
        author: row.created_by
          ? { full_name: nameById.get(row.created_by) ?? null }
          : null,
      };
    });

    setHasMore(mapped.length === PAGE_SIZE);
    setLogs((prev) => (append ? [...prev, ...mapped] : mapped));
  }, []);

  useEffect(() => {
    void fetchPage(0, false).finally(() => setLoading(false));
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    await fetchPage(logs.length, true);
    setLoadingMore(false);
  }

  return (
    <main className="mx-auto w-full max-w-[470px] flex-1 px-0 py-4 md:py-6">
      <div className="mb-4 px-4">
        <h1 className="font-heading text-2xl">Feed</h1>
        <p className="text-sm text-muted-foreground">
          Daily logs from all jobs, newest first.
        </p>
      </div>

      {loading ? (
        <p className="px-4 text-sm text-muted-foreground">Loading feed…</p>
      ) : error ? (
        <p className="px-4 text-sm text-destructive">{error}</p>
      ) : logs.length === 0 ? (
        <p className="px-4 text-sm text-muted-foreground">
          No logs yet. Employees can add the first daily log.
        </p>
      ) : (
        <div className="space-y-6 px-2 sm:px-4">
          {logs.map((log) => (
            <FeedCard key={log.id} log={log} />
          ))}
          {hasMore ? (
            <div className="flex justify-center pb-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
