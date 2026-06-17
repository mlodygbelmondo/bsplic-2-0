-- Add admin-managed pairwise AKO exclusions between sportsbook bets.

CREATE TABLE IF NOT EXISTS public.bet_ako_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id_a UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
  bet_id_b UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (bet_id_a <> bet_id_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS bet_ako_exclusions_pair_unique
  ON public.bet_ako_exclusions (
    LEAST(bet_id_a, bet_id_b),
    GREATEST(bet_id_a, bet_id_b)
  );

CREATE INDEX IF NOT EXISTS bet_ako_exclusions_bet_id_a_idx
  ON public.bet_ako_exclusions(bet_id_a);

CREATE INDEX IF NOT EXISTS bet_ako_exclusions_bet_id_b_idx
  ON public.bet_ako_exclusions(bet_id_b);

ALTER TABLE public.bet_ako_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read AKO exclusions"
  ON public.bet_ako_exclusions;
CREATE POLICY "Authenticated users can read AKO exclusions"
  ON public.bet_ako_exclusions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only admins can manage AKO exclusions"
  ON public.bet_ako_exclusions;
CREATE POLICY "Only admins can manage AKO exclusions"
  ON public.bet_ako_exclusions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
