# BSPLIC agent automation

The production sportsbook automation runs as a ChatGPT Scheduled Task. It uses
the deployed Supabase MCP endpoint and the user's ChatGPT Pro subscription, so
it does not consume OpenAI API credits.

## External configuration

- Schedule: every day at `00:00` in `Europe/Warsaw`.
- MCP endpoint:
  `https://imucpqgglvarpoezhbdb.supabase.co/functions/v1/bsplic-agent-mcp`.
- Authentication: set the deployed `BSPLIC_MCP_ACCESS_TOKEN` as the private
  bearer token for the ChatGPT connector. Never put the token in this repo.
- Enable all BSPLIC MCP tools and grant persistent permission for their write
  actions so the task can finish without a browser session.
- Paste [the Scheduled Task prompt](../.codex/skills/bsplic-bet-agent-ops/assets/scheduled-task-prompt.md)
  into the task instructions.

The Edge Function performs its own token, odds freshness, betting-window,
duplicate-key, settlement-evidence, and same-event AKO checks. The task prompt
controls discovery priorities and the normal target of 10 to 15 new markets.

After changing the prompt file, update the active Scheduled Task manually. The
ChatGPT task definition is external account state and cannot be deployed from
this repository.
