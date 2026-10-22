import { create } from 'zustand';

import { useAuthStore } from '@/features/auth/auth-store';
import type { SocialImageAttachment } from '../images';

export type PostSubmitHandler = (content: string, image?: SocialImageAttachment) => Promise<void>;

interface PostDraftState {
  content: string;
  image: SocialImageAttachment | null;
  /** A publish is in flight; kept here so a sheet reopened meanwhile cannot send the draft again. */
  submitting: boolean;
}

/**
 * The post draft (web: state in the parent `PostComposer`). It survives
 * closing the sheet and resets only after a successful publish.
 */
export const usePostDraftStore = create<PostDraftState>(() => ({ content: '', image: null, submitting: false }));

let submitHandler: PostSubmitHandler | null = null;

export const postDraftActions = {
  setContent: (content: string) => usePostDraftStore.setState({ content }),
  setImage: (image: SocialImageAttachment | null) => usePostDraftStore.setState({ image }),
  setSubmitting: (submitting: boolean) => usePostDraftStore.setState({ submitting }),
  reset: () => usePostDraftStore.setState({ content: '', image: null }),
  /** The trigger's `onSubmit`, registered when it opens the sheet. */
  setSubmitHandler: (handler: PostSubmitHandler) => {
    submitHandler = handler;
  },
  getSubmitHandler: () => submitHandler,
};

// A draft belongs to the account that wrote it: drop it on sign-out or an account switch.
useAuthStore.subscribe((state, previous) => {
  if (state.user?.id === previous.user?.id) return;
  usePostDraftStore.setState({ content: '', image: null, submitting: false });
  submitHandler = null;
});
