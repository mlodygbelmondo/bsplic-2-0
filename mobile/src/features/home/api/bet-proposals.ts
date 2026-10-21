import type { Json } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import type { ProposalBetType, ProposalOption } from '../logic/propose-bet';

interface CreateBetProposalParams {
  userId: string;
  title: string;
  categoryId: string | null;
  betType: ProposalBetType;
  options: ProposalOption[];
  /** Any date string `new Date()` accepts; sent as ISO. */
  endsAt: string;
}

/** Web `createBetProposal` (`src/features/home/api/betProposals.ts`). */
export async function createBetProposal({ userId, title, categoryId, betType, options, endsAt }: CreateBetProposalParams) {
  const { error } = await supabase.from('bet_proposals').insert({
    user_id: userId,
    title,
    category_id: categoryId,
    bet_type: betType,
    options: options as unknown as Json,
    ends_at: new Date(endsAt).toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }
}
