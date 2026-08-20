"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  ClipboardPlus,
  FileSpreadsheet,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Timer,
  User,
} from "lucide-react";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/roles";
import { isStaffRole } from "@/types/roles";

const staffNav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, mobile: true },
  { href: "/", label: "Logs", icon: ClipboardList, mobile: true },
  { href: "/schedule", label: "Schedule", icon: CalendarDays, mobile: true },
  { href: "/timeclock", label: "Clock", icon: Timer, mobile: true },
  { href: "/logs/new", label: "Add log", icon: ClipboardPlus, mobile: false },
  { href: "/estimates", label: "Estimates", icon: FileSpreadsheet, mobile: false },
  { href: "/chat", label: "Chat", icon: MessageCircle, mobile: true },
] as const;

const clientNav = [
  { href: "/", label: "Logs", icon: ClipboardList, mobile: true },
  { href: "/profile", label: "Profile", icon: User, mobile: true },
] as const;

const adminNavItem = {
  href: "/admin",
  label: "Admin",
  icon: Settings,
  mobile: true,
} as const;

function NavLink({
  href,
  label,
  icon: Icon,
  className,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground transition-colors",
        "min-h-11 min-w-11 touch-manipulation md:min-h-10 md:w-full md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2.5",
        "hover:bg-muted hover:text-foreground",
        "aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=page]:shadow-sm",
        className
      )}
    >
      <Icon className="size-6 shrink-0 md:size-5" aria-hidden />
      <span className="text-[0.65rem] font-medium leading-none md:text-sm">
        {label}
      </span>
    </Link>
  );
}

export function AppNavigation({ role }: { role: UserRole }) {
  const navItems = isStaffRole(role)
    ? role === "admin"
      ? [...staffNav, adminNavItem]
      : [...staffNav]
    : [...clientNav];

  return (
    <>
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex print:hidden"
        aria-label="Main navigation"
      >
        <div className="border-b border-sidebar-border px-4 py-5">
          <p className="font-heading text-lg text-sidebar-foreground">
            {siteConfig.name}
          </p>
          <p className="text-xs capitalize text-muted-foreground">{role}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </aside>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-background/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden print:hidden"
        aria-label="Main navigation"
      >
        {navItems
          .filter((item) => item.mobile)
          .map((item) => (
            <NavLink
              key={item.href}
              {...item}
              className="flex-1 flex-row justify-center gap-1 px-1"
            />
          ))}
      </nav>
    </>
  );
}
