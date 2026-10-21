-- Social writes go through the validated SECURITY DEFINER RPCs only.
--
-- Direct table INSERT/UPDATE let a client choose created_at, so a post dated
-- 2099 stayed at the top of the feed forever. The app never writes these
-- tables directly; create_social_post, add_social_comment and toggle_reaction
-- remain the write path.
DROP POLICY IF EXISTS "Users can insert own posts" ON public.social_posts;
DROP POLICY IF EXISTS "Users can insert own comments" ON public.social_comments;
DROP POLICY IF EXISTS "Users can insert own reactions" ON public.social_reactions;
DROP POLICY IF EXISTS "Users can update own reactions" ON public.social_reactions;
REVOKE INSERT, UPDATE ON TABLE public.social_posts FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE ON TABLE public.social_comments FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE ON TABLE public.social_reactions FROM PUBLIC, anon, authenticated;

-- Only the emit_* triggers record realtime events. Anyone with the public key
-- could insert events and make every open feed refetch the target item.
REVOKE EXECUTE ON FUNCTION public.record_social_realtime_event(TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

-- The pre-casino-share overloads skipped the auth.uid() check and were callable
-- by anon. They were unreachable only because PostgREST could not choose
-- between them and the six-argument versions. Calls without
-- p_casino_share_id now resolve to the checked versions through its default.
DROP FUNCTION IF EXISTS public.add_social_comment(UUID, TEXT, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.toggle_reaction(UUID, public.reaction_emoji, UUID, UUID, UUID);
