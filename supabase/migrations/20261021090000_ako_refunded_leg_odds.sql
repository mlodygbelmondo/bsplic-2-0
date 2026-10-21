-- A refunded AKO leg counts as odds 1.0. The coupon used to keep paying
-- stake x total_odds, so a cancelled leg still multiplied the payout. The
-- coupon screen already shows refunded legs at 1.0; settlement now pays the
-- same amount. Coupons without refunded legs keep stake x total_odds.

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
  v_leg_odds NUMERIC;
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
           payout = 0,
           settled_at = CASE
             WHEN status IS DISTINCT FROM 'lost' THEN NOW()
             ELSE settled_at
           END
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
             payout = ROUND(v_stake, 2),
             settled_at = CASE
               WHEN status IS DISTINCT FROM 'refund' THEN NOW()
               ELSE settled_at
             END
       WHERE id = NEW.coupon_id;
    ELSE
      IF v_refund > 0 THEN
        -- Multiply only the legs that won; refunded legs are worth 1.0.
        v_odds := 1;
        FOR v_leg_odds IN
          SELECT odds_at_time
            FROM public.placed_bets
           WHERE coupon_id = NEW.coupon_id
             AND result = 'won'
        LOOP
          v_odds := v_odds * v_leg_odds;
        END LOOP;
      END IF;

      UPDATE public.coupons
         SET status = 'won',
             payout = ROUND(v_stake * v_odds, 2),
             settled_at = CASE
               WHEN status IS DISTINCT FROM 'won' THEN NOW()
               ELSE settled_at
             END
       WHERE id = NEW.coupon_id;
    END IF;
  ELSE
    UPDATE public.coupons
       SET status = 'pending',
           payout = 0,
           settled_at = NULL
     WHERE id = NEW.coupon_id;
  END IF;

  RETURN NEW;
END;
$$;
