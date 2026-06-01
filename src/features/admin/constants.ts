export type AdminTab =
  | 'dashboard'
  | 'create'
  | 'manage'
  | 'proposals'
  | 'categories'
  | 'eniu'
  | 'bonuses';

export const BET_WINNING_OPTION_REFUND = '__refund__';
export const BET_WINNING_OPTION_FORCED_LOSS = '__all_lost__';

export const NO_CATEGORY_VALUE = '__none__';

export type EditableBetType = 'single' | '1x2' | '12' | 'multi';
