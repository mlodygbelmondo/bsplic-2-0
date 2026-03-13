import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

interface ProposalOption {
  name: string;
  odds: number;
}

interface CreateBetProposalParams {
  userId: string;
  title: string;
  categoryId: string | null;
  betType: '1x2' | '12' | 'multi';
  options: ProposalOption[];
}

export async function createBetProposal({
  userId,
  title,
  categoryId,
  betType,
  options,
}: CreateBetProposalParams) {
  const { error } = await supabase.from('bet_proposals').insert({
    user_id: userId,
    title,
    category_id: categoryId,
    bet_type: betType,
    options: options as unknown as Json,
  });

  if (error) {
    throw new Error(error.message);
  }
}
