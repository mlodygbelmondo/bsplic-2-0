# Product

## Register

product

## Users

A closed group of Polish friends who bet play-money (zł) on custom events: sports, social happenings, and casino games. They use the app daily, mostly on phones as an installed PWA, often in low-light settings (evening couch, bar). Polish is the only UI language.

## Product Purpose

BSPLIC 2.0 is a private sportsbook + casino: members browse admin-created bets, build coupons, top up a daily allowance, climb rankings, and react to each other's wins in a social feed. Success is the group having fun and coming back daily; there is no real money and no acquisition funnel.

## Brand Personality

Energetic, bookmaker-confident, tongue-in-cheek. It mimics the visual language of real Polish bookmakers (red brand color, yellow odds chips) but is self-aware fun between friends. Dark, casino-night atmosphere is the default mood.

## Anti-references

- Corporate gambling-site sterility (cookie walls, KYC vibes, fine print).
- Generic admin-dashboard grayness; the app should feel like a night venue, not a CRM.
- Loading flashes, mismatched skeletons, or janky transitions (top user complaint).

## Design Principles

1. **Bookmaker-real, friend-scale.** Use the genre's affordances (odds chips, coupons, LIVE badges) so everything is instantly familiar, but keep copy informal Polish.
2. **The bet card is the product.** Hierarchy, speed, and tap targets on cards and coupons beat any decoration.
3. **Atmosphere without cost.** Ambient depth (gradients, glow, motion) must be compositor-cheap and respect reduced motion; the app runs on older phones as a PWA.
4. **Instant always.** No loading flashes; navigation pre-warmed; skeletons match final layout.
5. **Moments of delight, not constant noise.** Shimmer/confetti/particles are reserved for special surfaces (boost cards, wins, casino), subtle everywhere else.

## Accessibility & Inclusion

- Respect `prefers-reduced-motion` globally (already enforced in `src/index.css`).
- Maintain ≥4.5:1 contrast for body text in both dark and light themes.
- Touch targets ≥40px on mobile betting surfaces.
