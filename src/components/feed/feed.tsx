"use client";

import { useCallback, useEffect, useState } from "react";

import { FeedCard } from "@/components/feed/feed-card";
import { FeedDetail } from "@/components/feed/feed-detail";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { FeedLog } from "@/types/feed";
import { cn } from "@/lib/utils";

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

function formatListDate(date: string) {
  try {
    return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

export function Feed() {
  const [logs, setLogs] = useState<FeedLog[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    setLogs((prev) => {
      const next = append ? [...prev, ...mapped] : mapped;
      setSelectedId((current) => current ?? next[0]?.id ?? null);
      return next;
    });
  }, []);

  useEffect(() => {
    void fetchPage(0, false).finally(() => setLoading(false));
  }, [fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    await fetchPage(logs.length, true);
    setLoadingMore(false);
  }

  const selected = logs.find((l) => l.id === selectedId) ?? logs[0] ?? null;

  const list = (
    <>
      {logs.map((log) => {
        const isSelected = log.id === selected?.id;
        return (
          <button
            key={log.id}
            type="button"
            onClick={() => setSelectedId(log.id)}
            className={cn(
              "w-full border-b border-border px-4 py-3 text-left transition-colors",
              "min-h-11 hover:bg-muted/60",
              isSelected && "bg-primary/15 hover:bg-primary/20"
            )}
          >
            <p className="text-xs text-muted-foreground">
              {formatListDate(log.date)}
              {log.job?.name ? ` · ${log.job.name}` : ""}
            </p>
            <p className="mt-0.5 truncate font-medium">
              {log.title?.trim() || "Daily log"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {log.author?.full_name?.trim() || "Team member"}
            </p>
          </button>
        );
      })}
      {hasMore ? (
        <div className="p-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </>
  );

  return (
    <main className="flex w-full flex-1 flex-col md:min-h-0">
      <div className="border-b border-border px-4 py-4 md:px-8">
        <h1 className="font-heading text-2xl md:text-3xl">Daily logs</h1>
        <p className="text-sm text-muted-foreground">
          Review reports by job and date. Newest first.
        </p>
      </div>

      {loading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Loading logs…</p>
      ) : error ? (
        <p className="px-4 py-6 text-sm text-destructive">{error}</p>
      ) : logs.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No logs yet. Employees can add the first daily log.
        </p>
      ) : (
        <>
          <div className="space-y-6 px-2 py-4 sm:px-4 md:hidden">
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

          <div className="hidden min-h-0 flex-1 md:flex">
            <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-border lg:w-96">
              {list}
            </aside>
            <section className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
              {selected ? <FeedDetail log={selected} /> : null}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
