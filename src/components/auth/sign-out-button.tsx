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

  async function onSignOut() {
    setLoading(true);
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    // Hard navigation clears session cookies so you don't stay on the Feed.
    window.location.assign("/login");
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={loading}
      onClick={() => void onSignOut()}
    >
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
