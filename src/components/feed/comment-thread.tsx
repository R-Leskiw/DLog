"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildCommentTree } from "@/lib/comments/build-tree";
import { createClient } from "@/lib/supabase/client";
import type { CommentNode, CommentRow } from "@/types/comments";
import { cn } from "@/lib/utils";

function CommentItem({
  node,
  depth,
  onReply,
}: {
  node: CommentNode;
  depth: number;
  onReply: (parentId: string) => void;
}) {
  const name = node.profiles?.full_name?.trim() || "User";
  return (
    <li className={cn(depth > 0 && "ml-4 border-l border-border pl-3")}>
      <p className="text-xs font-medium text-foreground">{name}</p>
      <p className="text-sm text-muted-foreground">{node.content}</p>
      {depth === 0 ? (
        <button
          type="button"
          className="mt-0.5 text-xs text-primary underline"
          onClick={() => onReply(node.id)}
        >
          Reply
        </button>
      ) : null}
      {node.replies.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {node.replies.map((r) => (
            <CommentItem
              key={r.id}
              node={r}
              depth={depth + 1}
              onReply={onReply}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CommentThread({ logId }: { logId: string }) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<CommentNode[]>([]);
  const [count, setCount] = useState(0);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { data, error: fetchError } = await supabase
      .from("comments")
      .select("id, log_id, user_id, content, parent_id, created_at")
      .eq("log_id", logId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    const rows = (data ?? []) as CommentRow[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const nameById = new Map<string, string | null>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        nameById.set(p.id, p.full_name);
      }
    }

    const enriched: CommentRow[] = rows.map((r) => ({
      ...r,
      profiles: {
        full_name: nameById.get(r.user_id) ?? null,
        role: null,
      },
    }));

    setCount(enriched.length);
    setTree(buildCommentTree(enriched));
  }, [logId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    const supabase = createClient();
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setLoading(true);
    setError(null);
    const { error: insertError } = await supabase.from("comments").insert({
      log_id: logId,
      user_id: user.id,
      content: trimmed,
      parent_id: replyTo,
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setText("");
    setReplyTo(null);
    await load();
  }

  return (
    <div className="border-t border-border px-3 py-2">
      <button
        type="button"
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide" : "View"} comments{count > 0 ? ` (${count})` : ""}
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
          {tree.length > 0 ? (
            <ul className="space-y-3">
              {tree.map((node) => (
                <CommentItem
                  key={node.id}
                  node={node}
                  depth={0}
                  onReply={(id) => setReplyTo(id)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          )}
          <form onSubmit={submit} className="flex gap-2">
            <Input
              placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-10 flex-1"
            />
            <Button
              type="submit"
              size="sm"
              className="min-h-10 shrink-0"
              disabled={loading}
            >
              Post
            </Button>
          </form>
          {replyTo ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setReplyTo(null)}
            >
              Cancel reply
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
