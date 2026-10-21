import type { SlotGame } from './model';

/**
 * Per-game look from the web `slots.css` (phone breakpoint, max-width 700px).
 * Slots keep their own dark art direction in both app themes.
 */
export interface SlotTheme {
  /** `--slot-accent` */
  accent: string;
  /** `.slots-page` background */
  page: string;
  /** `.slots-page` text color */
  ink: string;
  /** `.slots-heading h1` */
  title: string;
  titleItalic: boolean;
  /**
   * `.slots-atmosphere`: Midnight Bandit and Candy Cascade paint the art 850 px
   * tall from the top; Ember Forge and Pearl Tide cover the whole page.
   */
  atmosphere: 'top' | 'cover';
  atmosphereGradient: string;
  machineBackground: string;
  machineBorder: string;
  machineShadow: string;
  spinBackground: string;
  spinBorder: string;
  spinInk: string;
  spinShadow: string;
  /** Winning cell fill and border (`.slot-cell.is-winning`). */
  winningBackground: string;
  winningBorder: string;
  /** Ember Forge and Pearl Tide sprites sit on black and use `mix-blend-mode: screen`. */
  screenBlend: boolean;
}

const GOLD_SPIN = {
  spinBorder: '#fff0b0',
  spinInk: '#2d210b',
  spinShadow: '0px 4px 0px #866129, 0px 6px 20px #e9b43b22',
};

const GOLD_WINNING = {
  winningBackground: 'radial-gradient(ellipse at center, #dabd3866, #dabd3820)',
  winningBorder: '#ffe293',
};

export const SLOT_THEMES: Record<SlotGame, SlotTheme> = {
  bandit: {
    accent: '#eac475',
    page: '#061410',
    ink: '#fff4d8',
    title: '#ffe5a5',
    titleItalic: false,
    atmosphere: 'top',
    atmosphereGradient: 'linear-gradient(180deg, rgba(3, 13, 12, 0.4), #061410 95%)',
    machineBackground: 'linear-gradient(145deg, #284039, #091a17 45%, #16322a)',
    machineBorder: '#ad8b47',
    machineShadow: '0px 0px 0px 5px #061713, 0px 0px 0px 6px #d5bc6955, 0px 20px 70px #00000088, inset 0px 1px 0px #ffffaa55',
    spinBackground: 'linear-gradient(180deg, #f6d994, #d4a651)',
    ...GOLD_SPIN,
    ...GOLD_WINNING,
    screenBlend: false,
  },
  candy: {
    accent: '#ffc4dc',
    page: '#261122',
    ink: '#fff0f6',
    title: '#ffe2ee',
    titleItalic: true,
    atmosphere: 'top',
    atmosphereGradient: 'linear-gradient(180deg, rgba(43, 10, 35, 0.33), #261122 95%)',
    machineBackground: 'linear-gradient(145deg, #773b60, #331128 50%, #562244)',
    machineBorder: '#e8a5b8',
    machineShadow: '0px 0px 0px 5px #37162b, 0px 0px 0px 6px #ffbfc955, 0px 20px 70px #20001a88, inset 0px 1px 0px #ffddee55',
    spinBackground: 'linear-gradient(180deg, #ffd4e6, #ed91b9)',
    spinBorder: '#ffdfeb',
    spinInk: '#501832',
    spinShadow: '0px 4px 0px #9e476c, 0px 6px 20px #eb81b122',
    winningBackground: 'linear-gradient(#fb99d444, #fb99d444)',
    winningBorder: '#ffcbe9',
    screenBlend: false,
  },
  ember: {
    accent: '#ffbd79',
    page: '#1c0e08',
    ink: '#fff0da',
    title: '#ffe5a5',
    titleItalic: false,
    atmosphere: 'cover',
    atmosphereGradient: 'linear-gradient(180deg, #00000033, #00000088)',
    machineBackground: 'linear-gradient(145deg, #623421, #23120e 50%, #49251a)',
    machineBorder: '#dc9b59',
    machineShadow: '0px 0px 0px 5px #261109, 0px 0px 0px 6px #f0b77b66, 0px 20px 70px #00000088',
    spinBackground: 'linear-gradient(145deg, #ffd0a0, #d77d38)',
    ...GOLD_SPIN,
    ...GOLD_WINNING,
    screenBlend: true,
  },
  tide: {
    accent: '#a8f4f0',
    page: '#062128',
    ink: '#e9ffff',
    title: '#ffe5a5',
    titleItalic: false,
    atmosphere: 'cover',
    atmosphereGradient: 'linear-gradient(180deg, #00000033, #00000088)',
    machineBackground: 'linear-gradient(145deg, #25606a, #08262e 50%, #13434e)',
    machineBorder: '#9bd7da',
    machineShadow: '0px 0px 0px 5px #08232b, 0px 0px 0px 6px #9bd7da66, 0px 20px 70px #00000088',
    spinBackground: 'linear-gradient(145deg, #dbffff, #70cdd4)',
    ...GOLD_SPIN,
    ...GOLD_WINNING,
    screenBlend: true,
  },
};

/** Shared `slots.css` colors. */
export const SLOT_COLORS = {
  positive: '#98e4b1',
  negative: '#ffb1b7',
  muted: 'rgba(255, 255, 255, 0.651)', // #ffffffa6
  dim: 'rgba(255, 255, 255, 0.6)', // #ffffff99 / #fff9
  white: '#ffffff',
  /** `.slot-icon-button` */
  iconBorder: 'rgba(255, 255, 255, 0.149)', // #ffffff26
  iconBackground: 'rgba(0, 0, 0, 0.333)', // #0005
  /** `.slot-stake` / `.slots-session` */
  panelBackground: 'rgba(0, 0, 0, 0.267)', // #0004
  sessionBorder: 'rgba(255, 255, 255, 0.071)', // #ffffff12
  stopBorder: 'rgba(255, 255, 255, 0.251)', // #ffffff40
  historyDivider: 'rgba(255, 255, 255, 0.082)', // #ffffff15
  /** `.slot-board` */
  boardBackground: 'rgba(0, 0, 0, 0.6)', // #0009
  boardBorder: 'rgba(212, 181, 105, 0.314)', // #d4b56950
  boardShadow: 'inset 0px 4px 24px #00000088',
  /** `.slot-cell` */
  cellBackground: 'radial-gradient(ellipse at center, #ffffff09, transparent 75%)',
  cellBorder: 'rgba(255, 255, 255, 0.024)', // #ffffff06
  winningShadow: 'inset 0px 0px 12px #ffd77944',
  goldenBackground: 'linear-gradient(#b6882833, #b6882833)',
  goldenBorder: 'rgba(214, 166, 65, 0.467)', // #d6a64177
  scatter: '#fff0a8',
  goldMultiplier: '#ffe891',
  /** Tailwind `text-amber-300` (bonus bar). */
  amber300: '#fcd34d',
} as const;
