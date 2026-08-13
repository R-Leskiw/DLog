import { LogImageCarousel } from "@/components/feed/log-image-carousel";
import { CommentThread } from "@/components/feed/comment-thread";
import type { FeedLog } from "@/types/feed";

function formatDate(date: string) {
  try {
    return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

export function FeedDetail({ log }: { log: FeedLog }) {
  const authorName = log.author?.full_name?.trim() || "Team member";
  const images = log.image_urls?.filter(Boolean) ?? [];
  const jobName = log.job?.name;

  return (
    <article className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-2 border-b border-border pb-4">
        <p className="text-sm text-muted-foreground">
          {formatDate(log.date)}
          {jobName ? ` · ${jobName}` : null}
        </p>
        <h2 className="font-heading text-3xl leading-tight">
          {log.title?.trim() || "Daily log"}
        </h2>
        <p className="text-sm text-muted-foreground">Posted by {authorName}</p>
      </header>

      {images.length > 0 ? (
        <LogImageCarousel urls={images} className="overflow-hidden rounded-lg" />
      ) : null}

      {log.work_performed?.trim() ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Work performed
          </h3>
          <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
            {log.work_performed}
          </p>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-3 text-sm font-semibold">
          Comments
        </h3>
        <CommentThread logId={log.id} />
      </section>
    </article>
  );
}
