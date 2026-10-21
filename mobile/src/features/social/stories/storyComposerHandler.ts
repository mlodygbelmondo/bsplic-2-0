import type { SocialImageAttachment } from '../images';

export type StorySubmitHandler = (content: string, image?: SocialImageAttachment) => Promise<void>;

let handler: StorySubmitHandler | null = null;

/** The strip's `onCreateStory`, registered when it opens `/sheets/compose-story`. */
export const storyComposerHandler = {
  set: (next: StorySubmitHandler) => {
    handler = next;
  },
  get: () => handler,
};
