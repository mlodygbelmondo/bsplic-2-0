-- Extend bet model with single type, BSPLICBOOST flag and refund settlement flow.

ALTER TABLE public.bets
DROP CONSTRAINT IF EXISTS bets_bet_type_check;

ALTER TABLE public.bets
ADD CONSTRAINT bets_bet_type_check CHECK (bet_type IN ('single', '1x2', '12', 'multi'));

ALTER TABLE public.bet_proposals
DROP CONSTRAINT IF EXISTS bet_proposals_bet_type_check;

ALTER TABLE public.bet_proposals
ADD CONSTRAINT bet_proposals_bet_type_check CHECK (bet_type IN ('single', '1x2', '12', 'multi'));

ALTER TABLE public.bets
ADD COLUMN IF NOT EXISTS is_bsplicboost BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.placed_bets
DROP CONSTRAINT IF EXISTS placed_bets_result_check;

ALTER TABLE public.placed_bets
ADD CONSTRAINT placed_bets_result_check CHECK (result IN ('pending', 'won', 'lost', 'refund'));

ALTER TABLE public.coupons
DROP CONSTRAINT IF EXISTS coupons_status_check;

ALTER TABLE public.coupons
ADD CONSTRAINT coupons_status_check CHECK (status IN ('pending', 'won', 'lost', 'refund'));

CREATE OR REPLACE FUNCTION public.resolve_coupon_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_resolved BIGINT;
  v_lost BIGINT;
  v_refund BIGINT;
  v_stake NUMERIC;
  v_odds NUMERIC;
BEGIN
  IF NEW.coupon_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE result IN ('won', 'lost', 'refund')),
         count(*) FILTER (WHERE result = 'lost'),
         count(*) FILTER (WHERE result = 'refund')
    INTO v_total, v_resolved, v_lost, v_refund
    FROM public.placed_bets
   WHERE coupon_id = NEW.coupon_id;

  IF v_lost > 0 THEN
    UPDATE public.coupons
       SET status = 'lost',
           payout = 0
     WHERE id = NEW.coupon_id;
    RETURN NEW;
  END IF;

  IF v_resolved = v_total THEN
    SELECT stake, total_odds
      INTO v_stake, v_odds
      FROM public.coupons
     WHERE id = NEW.coupon_id;

    IF v_refund = v_total THEN
      UPDATE public.coupons
         SET status = 'refund',
             payout = ROUND(v_stake, 2)
       WHERE id = NEW.coupon_id;
    ELSE
      UPDATE public.coupons
         SET status = 'won',
             payout = ROUND(v_stake * v_odds, 2)
       WHERE id = NEW.coupon_id;
    END IF;
  ELSE
    UPDATE public.coupons
       SET status = 'pending',
           payout = 0
     WHERE id = NEW.coupon_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Align historical data: any coupon with at least one lost leg is immediately lost.
UPDATE public.coupons c
   SET status = 'lost',
       payout = 0
 WHERE EXISTS (
   SELECT 1
     FROM public.placed_bets pb
    WHERE pb.coupon_id = c.id
      AND pb.result = 'lost'
 );
