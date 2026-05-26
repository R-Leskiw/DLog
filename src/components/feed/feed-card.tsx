import { LogImageCarousel } from "@/components/feed/log-image-carousel";
import { CommentThread } from "@/components/feed/comment-thread";
import type { FeedLog } from "@/types/feed";

function formatDate(date: string) {
  try {
    return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function excerpt(text: string | null, max = 160) {
  if (!text) return "";
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export function FeedCard({ log }: { log: FeedLog }) {
  const authorName = log.author?.full_name?.trim() || "Team member";
  const images = log.image_urls?.filter(Boolean) ?? [];
  const jobName = log.job?.name;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center gap-3 px-3 py-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary-foreground"
          aria-hidden
        >
          {authorName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{authorName}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(log.date)}
            {jobName ? (
              <>
                {" · "}
                <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                  {jobName}
                </span>
              </>
            ) : null}
          </p>
        </div>
      </header>

      {images.length > 0 ? <LogImageCarousel urls={images} /> : null}

      <div className="space-y-1 px-3 py-3">
        {log.title ? (
          <h2 className="font-heading text-base leading-snug">{log.title}</h2>
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
