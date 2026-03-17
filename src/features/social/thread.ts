/**
 * Thread builder: transforms a flat comment list into a tree structure
 * for rendering nested comment threads.
 */

export interface FlatComment {
  id: string;
  user_id: string;
  username: string;
  avatar_url?: string | null;
  content: string;
  parent_id: string | null;
  created_at: string;
  reactions: Record<string, number> | null;
  my_reaction: string | null;
  image_path?: string | null;
}

export interface CommentNode extends FlatComment {
  children: CommentNode[];
}

/**
 * Builds a tree of comments from a flat array.
 * Top-level comments (parent_id === null) become root nodes.
 * Replies are nested under their parent.
 * Unknown parent_ids are treated as root nodes.
 */
export function buildCommentTree(comments: FlatComment[]): CommentNode[] {
  const nodeMap = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  // Create nodes
  for (const comment of comments) {
    nodeMap.set(comment.id, { ...comment, children: [] });
  }

  // Link children to parents
  for (const comment of comments) {
    const node = nodeMap.get(comment.id)!;
    if (comment.parent_id && nodeMap.has(comment.parent_id)) {
      nodeMap.get(comment.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Counts the total number of comments in a tree (including nested).
 */
export function countComments(nodes: CommentNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countComments(node.children);
  }
  return count;
}
