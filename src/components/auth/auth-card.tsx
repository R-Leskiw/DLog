import type { ReactNode } from "react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/config/site";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <Link
        href="/"
        className="mb-6 block text-center font-heading text-2xl text-foreground"
      >
        {siteConfig.name}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
        {footer ? (
          <div className="border-t border-border px-4 py-3 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
