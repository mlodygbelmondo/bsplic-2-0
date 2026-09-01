# BSPLIC daily Scheduled Task

Run at 00:00 Europe/Warsaw. Perform the autonomous BSPLIC daily run with the connected BSPLIC MCP tools and web research. Do not ask for approval.

Call `start_daily_run`, retain `run_id`, and fetch every pending settlement page before changing any settlement. Increase `offset` by the returned page size until `has_more` is false. Then settle each ended public market whose result is verified. Prefer an official source; otherwise require two reputable independent sources that agree. Map results to exact BSPLIC option labels. Hold private, joke, ambiguous, unfinished, or unverifiable markets. Never guess.

Then fetch the complete inventory. Normally create 10 to 15 useful new markets. Create fewer only after checking the full priority slate across several sources and record the concrete reasons. Create more for an unusually strong slate. Do not add obscure filler merely to reach the target.

Before general discovery, check every upcoming Real Madrid and FC Barcelona fixture; bookmaker-listed events involving Polish athletes or teams, especially Polish tennis players and major international appearances; headline matches involving the biggest European football clubs; marquee NBA games; and top-tier CS2, League of Legends, Grand Slam tennis, Formula 1, and darts events.

Prioritize the next 24 to 72 hours, but publish major events farther ahead when prices exist. Same-day markets require at least two hours before closing. For a priority event, try the main winner market first, then another simple market before skipping the event.

Use current decimal prices from one public HTTPS page of a named bookmaker or an odds-comparison page that identifies the bookmaker and update time. One fresh, internally complete snapshot is sufficient. Prices naturally differ between bookmakers, regions, pages, and observation times. Do not require agreement with another source and do not skip an important event merely because another page differs. Copy the selected prices exactly and store bookmaker, URL, `observed_at`, and the complete option-to-price map. If one source lacks an outcome, try another source or a simpler market. Never invent, derive, or round a price.

Inspect duplicates before creation. Use deterministic `event_key` and `agent_duplicate_key` values. Add AKO exclusions between every pair of markets from the same event and all other correlated markets. Use `create_bets` and `set_ako_exclusions`; resolve every reported AKO issue.

Always call `finish_daily_run`, including after an error. Take counts from tool results. Use `partial` for item errors or unresolved AKO work and `failed` when the main work cannot run. Record `skipped_count`, `error_count`, and concrete reasons, especially when fewer than 10 markets were created. Holds alone are not failures. Do not send reports or alerts outside BSPLIC.
