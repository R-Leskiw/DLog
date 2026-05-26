import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/profile/profile-form";
import { getSessionUser } from "@/lib/auth/profile";

export default async function ProfilePage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");
  if (profile?.role !== "client") redirect("/");

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 md:px-8 md:py-8">
      <h1 className="mb-6 font-heading text-3xl">Profile</h1>
      <ProfileForm
        email={user.email ?? ""}
        initialName={profile?.full_name ?? ""}
        role={profile?.role ?? "client"}
      />
    </main>
  );
}
