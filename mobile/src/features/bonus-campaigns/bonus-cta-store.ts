import { create } from 'zustand';

/**
 * Whether the floating `Odbierz bonus` button is on screen (web toggles the
 * `bonus-campaign-cta-visible` body class). The mobile coupon trigger reads it
 * to lift itself above the button (web `index.css` 702-703: its bottom becomes
 * `4.5rem + floating stack offset + safe area`).
 */
export const useBonusCtaStore = create<{ visible: boolean }>(() => ({ visible: false }));

export const useBonusCtaVisible = () => useBonusCtaStore((s) => s.visible);

export const setBonusCtaVisible = (visible: boolean) => {
  if (useBonusCtaStore.getState().visible !== visible) useBonusCtaStore.setState({ visible });
};
