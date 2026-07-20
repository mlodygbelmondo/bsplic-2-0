import type { SocialComment } from '@/types/database';

export interface CommentNode extends SocialComment {
  children: CommentNode[];
}

export function buildCommentTree(comments: SocialComment[]): CommentNode[] {
  const nodes = new Map(comments.map((comment) => [comment.id, { ...comment, children: [] as CommentNode[] }]));
  const roots: CommentNode[] = [];
  for (const comment of comments) {
    const node = nodes.get(comment.id);
    if (!node) continue;
    const parent = comment.parent_id ? nodes.get(comment.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
