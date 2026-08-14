import { NextResponse } from "next/server";

import { postLoginPath } from "@/lib/auth/home-path";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/roles";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const authError = searchParams.get("error");

  if (authError) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let dest = next;
      if (dest === "/") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, approval_status")
            .eq("id", user.id)
            .maybeSingle();
          if (profile?.approval_status === "approved") {
            dest = postLoginPath(profile.role as UserRole);
          }
        }
      }
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
