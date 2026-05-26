"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/roles";

export function ProfileForm({
  email,
  initialName,
  role,
}: {
  email: string;
  initialName: string;
  role: UserRole;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const supabase = createClient();
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setLoading(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Profile updated.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
          <CardDescription>
            Email and role are read-only. Update your display name below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={email}
              readOnly
              disabled
              className="min-h-11 bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={role}
              readOnly
              disabled
              className="min-h-11 bg-muted capitalize"
            />
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
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
            <Button type="submit" className="min-h-11 w-full" disabled={loading}>
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <SignOutButton className="min-h-11 w-full" />
    </div>
  );
}
