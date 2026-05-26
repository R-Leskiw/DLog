import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="font-heading text-xl">{siteConfig.name}</span>
          <div className="flex gap-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-11")}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "min-h-11")}
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16 text-center md:px-8">
        {!process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? (
          <p
            className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
            role="status"
          >
            Supabase is not configured. Copy{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              .env.example
            </code>{" "}
            to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              .env.local
            </code>
            , add your project URL and anon key, then restart the dev server to
            use sign-in and the home feed.
          </p>
        ) : null}
        <h1 className="font-heading text-4xl text-foreground md:text-5xl">
          Daily logs your whole team can trust
        </h1>
        <p className="text-lg text-muted-foreground">
          Field crews post site updates with photos. Clients and PMs follow every
          job in one scrolling feed—with comments built in.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-8")}
          >
            Get started
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "min-h-11 px-8"
            )}
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
