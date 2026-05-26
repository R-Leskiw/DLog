import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LogsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl">Daily logs</h1>
          <p className="mt-1 text-muted-foreground">
            Browse the home feed for daily updates, or add a new log from the
            Add tab.
          </p>
        </div>
        <Link
          href="/logs/new"
          className={cn(
            buttonVariants({ size: "lg" }),
            "min-h-11 w-full justify-center sm:w-auto"
          )}
        >
          Add daily log
        </Link>
      </header>
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Log list and split-pane detail will live here.
      </div>
    </main>
  );
}
