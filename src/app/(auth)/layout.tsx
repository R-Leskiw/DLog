import type { ReactNode } from "react";

/** Auth screens (sign-in, etc.) — no employee/office shell */
export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      {children}
    </div>
  );
}
