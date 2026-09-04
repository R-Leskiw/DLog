"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export type Crumb = {
  label: string;
  href?: string;
};

function previousHref(items: Crumb[]): string | undefined {
  for (let i = items.length - 2; i >= 0; i--) {
    if (items[i]?.href) return items[i].href;
  }
  return undefined;
}

export function PageBackButton({
  fallbackHref = "/",
  label = "Back",
  className,
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
        className
      )}
    >
      <ChevronLeft className="size-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

export function PageBreadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("text-sm text-muted-foreground", className)}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-1.5"
            >
              {index > 0 ? (
                <span aria-hidden className="text-muted-foreground/70">
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "inline-flex min-h-11 items-center",
                    isLast && "font-medium text-foreground"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Universal top trail: Back button + breadcrumbs. */
export function PageTrail({
  items,
  fallbackHref,
  backLabel = "Back",
  className,
}: {
  items: Crumb[];
  fallbackHref?: string;
  backLabel?: string;
  className?: string;
}) {
  const fallback = fallbackHref ?? previousHref(items) ?? "/";

  return (
    <div className={cn("mb-2 space-y-0.5", className)}>
      <PageBackButton fallbackHref={fallback} label={backLabel} />
      <PageBreadcrumbs items={items} />
    </div>
  );
}
