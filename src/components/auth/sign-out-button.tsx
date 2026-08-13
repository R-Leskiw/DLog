"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "ghost" | "default";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      setLoading(false);
      return;
    }
    // Hard navigation so cookies/session are fully cleared before the next page.
    window.location.assign("/login");
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        className={className}
        disabled={loading}
        onClick={() => void onSignOut()}
      >
        {loading ? "Signing out…" : "Sign out"}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
