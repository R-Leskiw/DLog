"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function VerifyEmailPanel({ email }: { email: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function resend() {
    const supabase = createClient();
    if (!supabase || !email) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    setLoading(false);
    setMessage(error ? error.message : "Confirmation email sent again.");
  }

  async function checkVerified() {
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setLoading(false);
    if (user?.email_confirmed_at) {
      router.push("/onboarding");
      router.refresh();
    } else {
      setMessage("Email not verified yet. Check your inbox and try again.");
    }
  }

  return (
    <AuthCard
      title="Verify your email"
      description={
        email
          ? `We sent a confirmation link to ${email}. You must verify before using BuildTrack.`
          : "Check your inbox for a confirmation link."
      }
      footer={
        <Link href="/login" className="font-medium text-primary underline">
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-3">
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
        <Button
          type="button"
          className="min-h-11 w-full"
          onClick={checkVerified}
          disabled={loading}
        >
          I verified my email
        </Button>
        {email ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            onClick={resend}
            disabled={loading}
          >
            Resend email
          </Button>
        ) : null}
      </div>
    </AuthCard>
  );
}
