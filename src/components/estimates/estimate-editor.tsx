"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Job } from "@/types/logs";
import {
  ESTIMATE_STATUSES,
  LINE_CATEGORIES,
  categoryLabel,
  emptyLine,
  estimateTotals,
  formatMoney,
  lineTotal,
  statusLabel,
  type Estimate,
  type EstimateLine,
  type EstimateStatus,
  type LineCategory,
  NEW_JOB_VALUE,
} from "@/types/estimates";

export function EstimateEditor({
  jobs,
  estimate,
  canEdit,
  saving,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  jobs: Job[];
  estimate: Estimate;
  canEdit: boolean;
  saving: boolean;
  onChange: (next: Estimate) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const totals = estimateTotals(
    estimate.lines,
    estimate.markup_percent,
    estimate.tax_percent
  );
  const isNew = estimate.id.startsWith("new-");

  function patch(partial: Partial<Estimate>) {
    onChange({ ...estimate, ...partial });
  }

  function patchLine(key: string, partial: Partial<EstimateLine>) {
    onChange({
      ...estimate,
      lines: estimate.lines.map((line) =>
        line.key === key ? { ...line, ...partial } : line
      ),
    });
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl">
            {isNew ? "New estimate" : estimate.title.trim() || "Estimate"}
          </h2>
          <p className="text-sm text-muted-foreground print:hidden">
            {canEdit
              ? "Line items, markup, and tax. Totals update as you type."
              : "View only — ask an admin to edit this estimate."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => window.print()}
          >
            Print
          </Button>
          {canEdit ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="min-h-11"
                onClick={onSave}
                disabled={
                  saving ||
                  !estimate.title.trim() ||
                  (estimate.job_id === NEW_JOB_VALUE &&
                    !estimate.newJobName?.trim())
                }
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={onCancel}
            >
              Back
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="est-title">Title</Label>
          <Input
            id="est-title"
            className="min-h-11"
            value={estimate.title}
            onChange={(e) => patch({ title: e.target.value })}
            disabled={!canEdit}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="est-job">Job</Label>
          <select
            id="est-job"
            className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={estimate.job_id ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              if (value === NEW_JOB_VALUE) {
                patch({
                  job_id: NEW_JOB_VALUE,
                  newJobName: estimate.newJobName ?? "",
                  jobName: null,
                });
                return;
              }
              patch({
                job_id: value || null,
                newJobName: undefined,
                jobName:
                  jobs.find((j) => j.id === value)?.name ?? null,
              });
            }}
            disabled={!canEdit}
          >
            <option value="">No job</option>
            {canEdit ? <option value={NEW_JOB_VALUE}>New job</option> : null}
            {jobs
              .filter((j) => j.is_active || j.id === estimate.job_id)
              .map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
          </select>
        </div>
        {canEdit && estimate.job_id === NEW_JOB_VALUE ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="est-new-job">New job name</Label>
            <Input
              id="est-new-job"
              className="min-h-11"
              placeholder="e.g. Downtown Clinic Remodel"
              value={estimate.newJobName ?? ""}
              onChange={(e) => patch({ newJobName: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              This job will also appear in daily logs, timeclock, schedule, and
              filters.
            </p>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="est-status">Status</Label>
          <select
            id="est-status"
            className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={estimate.status}
            onChange={(e) =>
              patch({ status: e.target.value as EstimateStatus })
            }
            disabled={!canEdit}
          >
            {ESTIMATE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="est-markup">Markup %</Label>
            <Input
              id="est-markup"
              type="number"
              min={0}
              step="0.1"
              className="min-h-11"
              value={estimate.markup_percent}
              onChange={(e) =>
                patch({ markup_percent: Number(e.target.value) || 0 })
              }
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="est-tax">Tax %</Label>
            <Input
              id="est-tax"
              type="number"
              min={0}
              step="0.1"
              className="min-h-11"
              value={estimate.tax_percent}
              onChange={(e) =>
                patch({ tax_percent: Number(e.target.value) || 0 })
              }
              disabled={!canEdit}
            />
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-heading text-xl">Line items</h3>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 print:hidden"
              onClick={() =>
                onChange({ ...estimate, lines: [...estimate.lines, emptyLine()] })
              }
            >
              Add line
            </Button>
          ) : null}
        </div>

        {estimate.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No line items yet.</p>
        ) : (
          <ul className="space-y-3">
            {estimate.lines.map((line, index) => (
              <li
                key={line.key}
                className="space-y-3 rounded-xl border border-border p-3"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  Line {index + 1} · {formatMoney(lineTotal(line))}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <select
                      className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                      value={line.category}
                      onChange={(e) =>
                        patchLine(line.key, {
                          category: e.target.value as LineCategory,
                        })
                      }
                      disabled={!canEdit}
                    >
                      {LINE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {categoryLabel(cat)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Input
                      className="min-h-11"
                      value={line.description}
                      onChange={(e) =>
                        patchLine(line.key, { description: e.target.value })
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                    <div className="space-y-1.5">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="min-h-11"
                        value={line.quantity}
                        onChange={(e) =>
                          patchLine(line.key, {
                            quantity: Number(e.target.value) || 0,
                          })
                        }
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit</Label>
                      <Input
                        className="min-h-11"
                        placeholder="hr, lf…"
                        value={line.unit}
                        onChange={(e) =>
                          patchLine(line.key, { unit: e.target.value })
                        }
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Unit cost</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="min-h-11"
                        value={line.unit_cost}
                        onChange={(e) =>
                          patchLine(line.key, {
                            unit_cost: Number(e.target.value) || 0,
                          })
                        }
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 print:hidden"
                    onClick={() =>
                      onChange({
                        ...estimate,
                        lines: estimate.lines.filter((l) => l.key !== line.key),
                      })
                    }
                  >
                    Remove line
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <dl className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{formatMoney(totals.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">
            Markup ({estimate.markup_percent || 0}%)
          </dt>
          <dd className="tabular-nums">{formatMoney(totals.markup)}</dd>
        </div>
        <div className="flex justify-between gap-4 text-sm">
          <dt className="text-muted-foreground">
            Tax ({estimate.tax_percent || 0}%)
          </dt>
          <dd className="tabular-nums">{formatMoney(totals.tax)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-border pt-2">
          <dt className="font-heading text-lg">Total</dt>
          <dd className="font-heading text-lg tabular-nums">
            {formatMoney(totals.total)}
          </dd>
        </div>
      </dl>

      {canEdit && onDelete && !isNew ? (
        <Button
          type="button"
          variant="destructive"
          className="min-h-11 print:hidden"
          onClick={onDelete}
          disabled={saving}
        >
          Delete estimate
        </Button>
      ) : null}
    </div>
  );
}
