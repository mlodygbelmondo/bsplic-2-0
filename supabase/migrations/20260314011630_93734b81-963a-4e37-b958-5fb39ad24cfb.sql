-- Drop triggers if they already exist (from local testing)
DROP TRIGGER IF EXISTS trg_update_streak ON public.placed_bets;
DROP TRIGGER IF EXISTS trg_badges_on_insert ON public.placed_bets;
DROP TRIGGER IF EXISTS trg_badges_on_result ON public.placed_bets;
DROP TRIGGER IF EXISTS trg_resolve_coupon ON public.placed_bets;
DROP TRIGGER IF EXISTS trg_badge_proposal ON public.bet_proposals;

-- Create triggers
CREATE TRIGGER trg_update_streak
  AFTER INSERT ON public.placed_bets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_streak();

CREATE TRIGGER trg_badges_on_insert
  AFTER INSERT ON public.placed_bets
  FOR EACH ROW
  EXECUTE FUNCTION public.check_badges_on_bet_insert();

CREATE TRIGGER trg_badges_on_result
  AFTER UPDATE ON public.placed_bets
  FOR EACH ROW
  WHEN (NEW.result IS DISTINCT FROM OLD.result)
  EXECUTE FUNCTION public.check_badges_on_bet_result();

CREATE TRIGGER trg_resolve_coupon
  AFTER UPDATE ON public.placed_bets
  FOR EACH ROW
  WHEN (NEW.result IS DISTINCT FROM OLD.result)
  EXECUTE FUNCTION public.resolve_coupon_status();

CREATE TRIGGER trg_badge_proposal
  AFTER UPDATE ON public.bet_proposals
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted')
  EXECUTE FUNCTION public.check_badge_on_proposal_accept();