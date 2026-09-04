import type { ReactNode } from "react";

import { AppNavigation } from "@/components/layout/app-navigation";
import type { UserRole } from "@/types/roles";

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
      <div className="flex min-h-0 flex-1 flex-col md:pl-64 print:pl-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </div>
    </div>
  );
}
