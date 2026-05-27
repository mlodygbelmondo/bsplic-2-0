CREATE TABLE IF NOT EXISTS public.social_realtime_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'coupon', 'casino')),
  target_id UUID NOT NULL,
  source_table TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_realtime_events_created
  ON public.social_realtime_events (created_at DESC);

ALTER TABLE public.social_realtime_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view social realtime events" ON public.social_realtime_events;
CREATE POLICY "Users can view social realtime events"
  ON public.social_realtime_events FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON public.social_realtime_events TO authenticated;

CREATE OR REPLACE FUNCTION public.record_social_realtime_event(
  p_target_type TEXT,
  p_target_id UUID,
  p_source_table TEXT,
  p_operation TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_target_type IS NULL OR p_target_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.social_realtime_events (
    target_type,
    target_id,
    source_table,
    operation
  )
  VALUES (
    p_target_type,
    p_target_id,
    p_source_table,
    p_operation
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_social_realtime_event(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.emit_social_post_realtime_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_social_realtime_event(
    'post',
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_TABLE_NAME,
    TG_OP
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.emit_casino_social_share_realtime_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_social_realtime_event(
    'casino',
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_TABLE_NAME,
    TG_OP
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.emit_social_comment_realtime_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.social_comments%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;

  PERFORM public.record_social_realtime_event(
    CASE
      WHEN v_row.post_id IS NOT NULL THEN 'post'
      WHEN v_row.coupon_id IS NOT NULL THEN 'coupon'
      WHEN v_row.casino_share_id IS NOT NULL THEN 'casino'
      ELSE NULL
    END,
    COALESCE(v_row.post_id, v_row.coupon_id, v_row.casino_share_id),
    TG_TABLE_NAME,
    TG_OP
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.emit_social_reaction_realtime_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.social_reactions%ROWTYPE;
  v_comment public.social_comments%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;

  IF v_row.comment_id IS NOT NULL THEN
    SELECT *
    INTO v_comment
    FROM public.social_comments
    WHERE id = v_row.comment_id;

    PERFORM public.record_social_realtime_event(
      CASE
        WHEN v_comment.post_id IS NOT NULL THEN 'post'
        WHEN v_comment.coupon_id IS NOT NULL THEN 'coupon'
        WHEN v_comment.casino_share_id IS NOT NULL THEN 'casino'
        ELSE NULL
      END,
      COALESCE(v_comment.post_id, v_comment.coupon_id, v_comment.casino_share_id),
      TG_TABLE_NAME,
      TG_OP
    );
  ELSE
    PERFORM public.record_social_realtime_event(
      CASE
        WHEN v_row.post_id IS NOT NULL THEN 'post'
        WHEN v_row.coupon_id IS NOT NULL THEN 'coupon'
        WHEN v_row.casino_share_id IS NOT NULL THEN 'casino'
        ELSE NULL
      END,
      COALESCE(v_row.post_id, v_row.coupon_id, v_row.casino_share_id),
      TG_TABLE_NAME,
      TG_OP
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.emit_social_coupon_realtime_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.record_social_realtime_event(
    'coupon',
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    TG_TABLE_NAME,
    TG_OP
  );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.emit_social_placed_bet_realtime_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_coupon_id := OLD.coupon_id;
  ELSE
    v_coupon_id := NEW.coupon_id;
  END IF;

  IF v_coupon_id IS NOT NULL THEN
    PERFORM public.record_social_realtime_event(
      'coupon',
      v_coupon_id,
      TG_TABLE_NAME,
      TG_OP
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_posts_realtime_event ON public.social_posts;
CREATE TRIGGER trg_social_posts_realtime_event
  AFTER INSERT OR UPDATE OR DELETE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.emit_social_post_realtime_event();

DROP TRIGGER IF EXISTS trg_social_comments_realtime_event ON public.social_comments;
CREATE TRIGGER trg_social_comments_realtime_event
  AFTER INSERT OR UPDATE OR DELETE ON public.social_comments
  FOR EACH ROW EXECUTE FUNCTION public.emit_social_comment_realtime_event();

DROP TRIGGER IF EXISTS trg_social_reactions_realtime_event ON public.social_reactions;
CREATE TRIGGER trg_social_reactions_realtime_event
  AFTER INSERT OR UPDATE OR DELETE ON public.social_reactions
  FOR EACH ROW EXECUTE FUNCTION public.emit_social_reaction_realtime_event();

DROP TRIGGER IF EXISTS trg_casino_social_shares_realtime_event ON public.casino_social_shares;
CREATE TRIGGER trg_casino_social_shares_realtime_event
  AFTER INSERT OR UPDATE OR DELETE ON public.casino_social_shares
  FOR EACH ROW EXECUTE FUNCTION public.emit_casino_social_share_realtime_event();

DROP TRIGGER IF EXISTS trg_coupons_social_realtime_event ON public.coupons;
CREATE TRIGGER trg_coupons_social_realtime_event
  AFTER INSERT OR UPDATE OR DELETE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.emit_social_coupon_realtime_event();

DROP TRIGGER IF EXISTS trg_placed_bets_social_realtime_event ON public.placed_bets;
CREATE TRIGGER trg_placed_bets_social_realtime_event
  AFTER INSERT OR UPDATE OR DELETE ON public.placed_bets
  FOR EACH ROW EXECUTE FUNCTION public.emit_social_placed_bet_realtime_event();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'social_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'social_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_comments;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'social_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_reactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'casino_social_shares'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.casino_social_shares;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'social_realtime_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.social_realtime_events;
  END IF;
END
$$;
