/**
 * Comment time label (web `CommentThread` `formatTimeAgo`): `teraz`, `min`,
 * `godz.`, `dn.` under a week, then the Polish date. Not the feed formatter.
 */
export function formatCommentTime(dateStr: string, now: number = Date.now()): string {
  const minutes = Math.floor((now - new Date(dateStr).getTime()) / 60000);
  if (minutes < 1) return 'teraz';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dn.`;
  return new Date(dateStr).toLocaleDateString('pl-PL');
}

/** Comment content with its image marker restored for `SocialContentBlock` (web appends `\n[[img:path]]`). */
export function withCommentImage(content: string, imagePath: string | null | undefined): string {
  return imagePath ? `${content}\n[[img:${imagePath}]]` : content;
}
