import { LogImageCarousel } from "@/components/feed/log-image-carousel";
import { CommentThread } from "@/components/feed/comment-thread";
import type { FeedLog } from "@/types/feed";

function formatStamp(date: string) {
  try {
    return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

function excerpt(text: string | null, max = 140) {
  if (!text) return "";
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export function FeedMobileCard({ log }: { log: FeedLog }) {
  const authorName = log.author?.full_name?.trim() || "Team member";
  const images = log.image_urls?.filter(Boolean) ?? [];
  const jobName = log.job?.name;

  return (
    <article className="border-b border-border bg-background">
      <header className="flex items-center gap-3 px-3 py-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          aria-hidden
        >
          {authorName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {jobName || "Job site"}
          </p>
          <p className="text-xs text-muted-foreground">
            {authorName} · {formatStamp(log.date)}
          </p>
        </div>
      </header>

      {images.length > 0 ? (
        <LogImageCarousel
          urls={images}
          className="aspect-[4/5] rounded-none md:aspect-[4/5] md:max-h-none"
        />
      ) : (
        <div className="flex aspect-[4/5] items-center justify-center bg-muted px-6 text-center text-sm text-muted-foreground">
          {log.title?.trim() || "No photo on this log"}
        </div>
      )}

      <div className="space-y-1 px-3 py-3">
        {log.title ? (
          <h2 className="text-sm font-semibold leading-snug">{log.title}</h2>
        ) : null}
        {log.work_performed ? (
          <p className="text-sm text-muted-foreground">
            {excerpt(log.work_performed)}
          </p>
        ) : null}
      </div>

      <CommentThread logId={log.id} />
    </article>
  );
}
