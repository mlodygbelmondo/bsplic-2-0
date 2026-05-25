import type { DisplayCategory, DisplayEvent } from '@/features/redesign/useRedesignData';
import type { Profile } from '@/types/database';

export type ConceptVariantProps = {
  events: DisplayEvent[];
  categories: DisplayCategory[];
  profile: Profile | null;
  loading: boolean;
};

export type ConceptVariantDefinition = {
  id: number;
  slug: string;
  label: string;
  description: string;
  component: (props: ConceptVariantProps) => JSX.Element;
};

export type MockGoalscorer = {
  id: string;
  rank: number;
  name: string;
  team: string;
  opponent: string;
  time: string;
  odds: number;
  accent: string;
};

export type MockParlay = {
  id: string;
  label: string;
  legs: string[];
  odds: number;
  picks: number;
};
