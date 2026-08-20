import { redirect } from "next/navigation";

import { ChatRoom } from "@/components/chat/chat-room";
import { getSessionUser } from "@/lib/auth/profile";
import { isStaffRole } from "@/types/roles";

export default async function ChatPage() {
  const { profile } = await getSessionUser();
  if (!isStaffRole(profile?.role)) redirect("/");

  return <ChatRoom />;
}
