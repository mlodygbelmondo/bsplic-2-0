-- Keep new Jackpot/AKO RLS policies cheaper for row scans.

DROP POLICY IF EXISTS "Only admins can manage AKO exclusions"
  ON public.bet_ako_exclusions;
DROP POLICY IF EXISTS "Only admins can insert AKO exclusions"
  ON public.bet_ako_exclusions;
DROP POLICY IF EXISTS "Only admins can update AKO exclusions"
  ON public.bet_ako_exclusions;
DROP POLICY IF EXISTS "Only admins can delete AKO exclusions"
  ON public.bet_ako_exclusions;

CREATE POLICY "Only admins can insert AKO exclusions"
  ON public.bet_ako_exclusions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Only admins can update AKO exclusions"
  ON public.bet_ako_exclusions
  FOR UPDATE
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Only admins can delete AKO exclusions"
  ON public.bet_ako_exclusions
  FOR DELETE
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Users can read own jackpot tickets"
  ON public.daily_jackpot_tickets;
CREATE POLICY "Users can read own jackpot tickets"
  ON public.daily_jackpot_tickets
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR public.has_role((SELECT auth.uid()), 'admin')
  );

DROP POLICY IF EXISTS "Admins can read jackpot funding"
  ON public.daily_jackpot_funding_entries;
CREATE POLICY "Admins can read jackpot funding"
  ON public.daily_jackpot_funding_entries
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Admins can read jackpot events"
  ON public.daily_jackpot_events;
CREATE POLICY "Admins can read jackpot events"
  ON public.daily_jackpot_events
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));
