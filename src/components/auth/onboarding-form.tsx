"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearPendingRole,
  getPendingRole,
} from "@/lib/auth/pending-role";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/roles";
import { cn } from "@/lib/utils";

export function OnboardingForm({
  initialRole,
}: {
  initialRole: UserRole | null;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>(initialRole ?? "employee");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const pending = getPendingRole();
    if (pending) setRole(pending);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setLoading(true);
    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName.trim(),
      role,
      updated_at: new Date().toISOString(),
    });
    setLoading(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    clearPendingRole();
    router.push("/");
    router.refresh();
  }

  return (
    <AuthCard
      title="Complete your profile"
      description="Tell us your name and confirm your role."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            required
            className="min-h-11"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["employee", "client"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "min-h-11 rounded-lg border px-3 text-sm font-medium capitalize",
                  role === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" className="min-h-11 w-full" disabled={loading}>
          {loading ? "Saving…" : "Continue to feed"}
        </Button>
      </form>
    </AuthCard>
  );
}
