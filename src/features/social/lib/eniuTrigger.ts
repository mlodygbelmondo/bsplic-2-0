import { respondAsEniu } from '@/features/social/api/eniuBot';
import { mentionsEniu } from '@/features/social/eniuBot';

/**
 * Fire-and-forget: if the content contains a Social Mention of Eniu,
 * request a Bot Reply and reload comments once it lands.
 */
export function triggerEniuBotReply(
  source: 'post' | 'comment',
  sourceId: string,
  content: string,
  reloadComments: () => Promise<unknown>,
) {
  if (!mentionsEniu(content)) return;

  void respondAsEniu(source, sourceId)
    .then((result) => {
      if (!result.ok) {
        console.error(
          'Eniu failed to respond',
          result.error || 'Eniu nie odpowiedział',
        );
      }
      return reloadComments();
    })
    .catch((error) => {
      const message =
        error instanceof Error ? error.message : 'Eniu nie odpowiedział';
      console.error('Eniu failed to respond', message);
    });
}
