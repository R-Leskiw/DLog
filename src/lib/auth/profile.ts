import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/roles";

export type Profile = {
  id: string;
  full_name: string | null;
  role: UserRole | null;
  updated_at?: string;
};

export function isEmailVerified(user: User | null): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at);
}

export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false;
  return Boolean(profile.full_name?.trim() && profile.role);
}

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, profile: null };
  const profile = await getProfileForUser(supabase, user.id);
  return { supabase, user, profile };
}

export async function getProfileForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}
