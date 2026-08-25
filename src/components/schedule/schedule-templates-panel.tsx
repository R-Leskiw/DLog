"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  ScheduleTemplate,
  ScheduleTemplateItem,
} from "@/types/schedule";

type DraftItem = {
  key: string;
  title: string;
  duration_days: number;
  lag_days: number;
  notes: string;
};

function blankItem(): DraftItem {
  return {
    key: crypto.randomUUID(),
    title: "",
    duration_days: 1,
    lag_days: 0,
    notes: "",
  };
}

export function ScheduleTemplatesPanel({
  templates,
  itemsByTemplate,
  jobId,
  jobName,
  canEdit,
  onSaveTemplate,
  onDeleteTemplate,
  onApplyTemplate,
}: {
  templates: ScheduleTemplate[];
  itemsByTemplate: Map<string, ScheduleTemplateItem[]>;
  jobId: string | null;
  jobName: string | null;
  canEdit: boolean;
  onSaveTemplate: (payload: {
    id?: string;
    name: string;
    description: string;
    items: {
      title: string;
      duration_days: number;
      lag_days: number;
      sort_order: number;
      notes: string | null;
    }[];
  }) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onApplyTemplate: (templateId: string, startDate: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);
  const [applyId, setApplyId] = useState("");
  const [applyStart, setApplyStart] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return null;

  function startNew() {
    setEditingId(null);
    setName("");
    setDescription("");
    setItems([blankItem()]);
    setOpen(true);
  }

  function startEdit(t: ScheduleTemplate) {
    const rows = itemsByTemplate.get(t.id) ?? [];
    setEditingId(t.id);
    setName(t.name);
    setDescription(t.description ?? "");
    setItems(
      rows.length
        ? rows.map((r) => ({
            key: r.id,
            title: r.title,
            duration_days: r.duration_days,
            lag_days: r.lag_days,
            notes: r.notes ?? "",
          }))
        : [blankItem()]
    );
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const cleaned = items
      .map((it, i) => ({
        title: it.title.trim(),
        duration_days: Math.max(1, Number(it.duration_days) || 1),
        lag_days: Math.max(0, Number(it.lag_days) || 0),
        sort_order: i,
        notes: it.notes.trim() || null,
      }))
      .filter((it) => it.title);
    if (!cleaned.length) {
      setError("Add at least one phase with a title.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSaveTemplate({
        id: editingId ?? undefined,
        name: trimmed,
        description: description.trim(),
        items: cleaned,
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save template.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!applyId || !jobId) return;
    setBusy(true);
    setError(null);
    try {
      await onApplyTemplate(applyId, applyStart);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply template.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl">Templates</h2>
          <p className="text-sm text-muted-foreground">
            Reusable phase lists you can drop onto a job.
          </p>
        </div>
        <Button type="button" variant="outline" className="min-h-11" onClick={startNew}>
          New template
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No templates yet. Create one for framing, finish, etc.
        </p>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => {
            const count = itemsByTemplate.get(t.id)?.length ?? 0;
            return (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {count} phase{count === 1 ? "" : "s"}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => startEdit(t)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="min-h-11"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete template “${t.name}”?`)) {
                        void onDeleteTemplate(t.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {jobId ? (
        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="apply-template">Apply to {jobName ?? "this job"}</Label>
            <select
              id="apply-template"
              className="flex min-h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={applyId}
              onChange={(e) => setApplyId(e.target.value)}
            >
              <option value="">Choose template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apply-start">Start date</Label>
            <Input
              id="apply-start"
              type="date"
              className="min-h-11"
              value={applyStart}
              onChange={(e) => setApplyStart(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="min-h-11"
            disabled={!applyId || busy}
            onClick={() => void apply()}
          >
            Apply
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Open a job to apply a template to that site.
        </p>
      )}

      {open ? (
        <form onSubmit={save} className="space-y-3 border-t border-border pt-3">
          <h3 className="font-heading text-lg">
            {editingId ? "Edit template" : "New template"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                className="min-h-11"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="tpl-desc">Description</Label>
              <Textarea
                id="tpl-desc"
                className="min-h-16"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Phases (in order)</p>
            {items.map((it, idx) => (
              <div
                key={it.key}
                className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_5rem_5rem_auto]"
              >
                <Input
                  className="min-h-11"
                  placeholder="Phase title"
                  value={it.title}
                  onChange={(e) => {
                    const next = [...items];
                    next[idx] = { ...it, title: e.target.value };
                    setItems(next);
                  }}
                />
                <div className="space-y-1">
                  <Label className="text-xs">Days</Label>
                  <Input
                    type="number"
                    min={1}
                    className="min-h-11"
                    value={it.duration_days}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = {
                        ...it,
                        duration_days: Number(e.target.value) || 1,
                      };
                      setItems(next);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lag</Label>
                  <Input
                    type="number"
                    min={0}
                    className="min-h-11"
                    value={it.lag_days}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = {
                        ...it,
                        lag_days: Number(e.target.value) || 0,
                      };
                      setItems(next);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  disabled={items.length <= 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setItems([...items, blankItem()])}
            >
              Add phase
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={busy}>
              {busy ? "Saving…" : "Save template"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
