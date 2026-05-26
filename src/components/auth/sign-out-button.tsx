"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  variant = "outline",
  className,
}: {
  variant?: "outline" | "ghost" | "default";
  className?: string;
}) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      onClick={async () => {
        const supabase = createClient();
        if (supabase) await supabase.auth.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
