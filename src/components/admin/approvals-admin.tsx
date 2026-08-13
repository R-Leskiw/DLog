"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { ApprovalStatus, RequestableRole, UserRole } from "@/types/roles";

type PendingProfile = {
  id: string;
  full_name: string | null;
  role: UserRole | null;
  approval_status: ApprovalStatus;
  updated_at: string | null;
};

export function ApprovalsAdmin() {
  const [rows, setRows] = useState<PendingProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<Record<string, RequestableRole>>(
    {}
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }
    const { data, error: loadError } = await supabase
      .from("profiles")
      .select("id, full_name, role, approval_status, updated_at")
      .in("approval_status", ["pending", "rejected"])
      .order("updated_at", { ascending: false });
    if (loadError) {
      setError(loadError.message);
    } else {
      const list = (data as PendingProfile[]) ?? [];
      setRows(list);
      const drafts: Record<string, RequestableRole> = {};
      list.forEach((row) => {
        drafts[row.id] =
          row.role === "client" || row.role === "employee"
            ? row.role
            : "employee";
      });
      setRoleDraft(drafts);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(
    row: PendingProfile,
    next: Extract<ApprovalStatus, "approved" | "rejected">
  ) {
    const supabase = createClient();
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setBusyId(row.id);
    setError(null);
    const payload: Record<string, unknown> = {
      approval_status: next,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      updated_at: new Date().toISOString(),
    };
    if (next === "approved") {
      payload.role = roleDraft[row.id] ?? "employee";
    }
    const { error: updateError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", row.id);
    setBusyId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading requests…</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between"
            >
              <div className="space-y-1">
                <p className="font-medium">
                  {row.full_name?.trim() || "Unnamed user"}
                </p>
                <p className="text-sm capitalize text-muted-foreground">
                  Requested: {row.role ?? "—"} · Status: {row.approval_status}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {row.approval_status === "pending" ? (
                  <>
                    <Select
                      value={roleDraft[row.id] ?? "employee"}
                      onValueChange={(v) =>
                        setRoleDraft((prev) => ({
                          ...prev,
                          [row.id]: (v as RequestableRole) ?? "employee",
                        }))
                      }
                    >
                      <SelectTrigger className="min-h-11 w-full sm:w-40">
                        <SelectValue placeholder="Role">
                          {roleDraft[row.id] === "client"
                            ? "Client"
                            : "Employee"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      className="min-h-11"
                      disabled={busyId === row.id}
                      onClick={() => void decide(row, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={busyId === row.id}
                      onClick={() => void decide(row, "rejected")}
                    >
                      Reject
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    className="min-h-11"
                    disabled={busyId === row.id}
                    onClick={() => void decide(row, "approved")}
                  >
                    Approve anyway
                  </Button>
                )}
              </div>
            </li>
          ))}
          {!rows.length ? (
            <li className="p-4 text-sm text-muted-foreground">
              No pending or rejected requests.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
