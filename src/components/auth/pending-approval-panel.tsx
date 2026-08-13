"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { ApprovalStatus, UserRole } from "@/types/roles";

export function PendingApprovalPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<ApprovalStatus | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("role, approval_status")
      .eq("id", user.id)
      .maybeSingle();
    setRole((data?.role as UserRole) ?? null);
    setStatus((data?.approval_status as ApprovalStatus) ?? "pending");
    setLoading(false);
    if (data?.approval_status === "approved") {
      router.push("/");
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function checkAgain() {
    setChecking(true);
    await load();
    setChecking(false);
  }

  if (loading) {
    return (
      <AuthCard title="Checking access…" description="One moment.">
        <p className="text-sm text-muted-foreground">Loading your status…</p>
      </AuthCard>
    );
  }

  const rejected = status === "rejected";

  return (
    <AuthCard
      title={rejected ? "Access declined" : "Waiting for approval"}
      description={
        rejected
          ? "A company admin declined this account. Contact your company owner if this is a mistake."
          : `Your ${role ?? "account"} request is pending. You’ll get access after an admin approves you.`
      }
      footer={<SignOutButton className="min-h-11 w-full" />}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Status:{" "}
          <span className="font-medium capitalize text-foreground">
            {status ?? "pending"}
          </span>
        </p>
        {!rejected ? (
          <Button
            type="button"
            className="min-h-11 w-full"
            onClick={checkAgain}
            disabled={checking}
          >
            {checking ? "Checking…" : "I’ve been approved — check again"}
          </Button>
        ) : null}
      </div>
    </AuthCard>
  );
}
