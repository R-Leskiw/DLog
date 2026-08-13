"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogImageCarousel({
  urls,
  className,
}: {
  urls: string[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  if (!urls.length) return null;

  const hasMany = urls.length > 1;

  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full bg-muted md:aspect-video md:max-h-[420px]",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[index]}
        alt=""
        className="size-full object-cover"
      />
      {hasMany ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 size-9 -translate-y-1/2 rounded-full opacity-90"
            onClick={() =>
              setIndex((i) => (i === 0 ? urls.length - 1 : i - 1))
            }
            aria-label="Previous photo"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 size-9 -translate-y-1/2 rounded-full opacity-90"
            onClick={() => setIndex((i) => (i + 1) % urls.length)}
            aria-label="Next photo"
          >
            <ChevronRight className="size-5" />
          </Button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
            {urls.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-1.5 rounded-full bg-background/80",
                  i === index && "bg-primary"
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
