import type { CommentNode, CommentRow } from "@/types/comments";

export function buildCommentTree(rows: CommentRow[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, replies: [] });
  }

  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
