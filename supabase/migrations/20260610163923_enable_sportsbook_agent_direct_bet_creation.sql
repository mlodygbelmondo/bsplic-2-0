-- Enable direct sportsbook bet creation for the approved local agent token.
-- This is intentionally scoped to the token-backed agent that just performed
-- reviewed settlement, and only when that token already has settlement access.

UPDATE private.agent_api_tokens
   SET scopes = (
     SELECT array_agg(DISTINCT scope_name ORDER BY scope_name)
       FROM unnest(scopes || ARRAY['create:bets']::TEXT[]) AS scope_name
   )
 WHERE agent_user_id = '160a384e-9bec-4198-a78f-28150e724229'::UUID
   AND 'settle:bets' = ANY(scopes)
   AND NOT 'create:bets' = ANY(scopes);
