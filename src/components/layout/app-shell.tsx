import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { AppNavigation } from "@/components/layout/app-navigation";
import type { UserRole } from "@/types/roles";
import { isStaffRole } from "@/types/roles";

export function AppShell({
  children,
  role,
}: {
  children: ReactNode;
  role: UserRole;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col md:h-dvh md:flex-row md:overflow-hidden">
      <AppNavigation role={role} />
      <div className="flex min-h-0 flex-1 flex-col md:pl-64">
        {isStaffRole(role) ? (
          <header className="hidden items-center justify-end border-b border-border px-6 py-2 md:flex">
            <SignOutButton variant="ghost" className="min-h-9" />
          </header>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </div>
    </div>
  );
}
