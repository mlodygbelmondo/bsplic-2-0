import { create } from 'zustand';

import type { SocialImageAttachment } from '../images';

export type PostSubmitHandler = (content: string, image?: SocialImageAttachment) => Promise<void>;

interface PostDraftState {
  content: string;
  image: SocialImageAttachment | null;
}

/**
 * The post draft (web: state in the parent `PostComposer`). It survives
 * closing the sheet and resets only after a successful publish.
 */
export const usePostDraftStore = create<PostDraftState>(() => ({ content: '', image: null }));

let submitHandler: PostSubmitHandler | null = null;

export const postDraftActions = {
  setContent: (content: string) => usePostDraftStore.setState({ content }),
  setImage: (image: SocialImageAttachment | null) => usePostDraftStore.setState({ image }),
  reset: () => usePostDraftStore.setState({ content: '', image: null }),
  /** The trigger's `onSubmit`, registered when it opens the sheet. */
  setSubmitHandler: (handler: PostSubmitHandler) => {
    submitHandler = handler;
  },
  getSubmitHandler: () => submitHandler,
};
