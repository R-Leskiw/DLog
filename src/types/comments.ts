export type CommentRow = {
  id: string;
  log_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  profiles?: {
    full_name: string | null;
    role: string | null;
  } | null;
};

export type CommentNode = CommentRow & {
  replies: CommentNode[];
};
