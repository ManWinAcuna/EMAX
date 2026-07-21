# EMaxing

A simplified consumer numerology app — "Energy Maxing." Separate from the
personal cockpit (`../numerology-app`), which is the read-only source of the
math. The math files in `lib/` are **copied** from the cockpit and must not be
hand-edited here; re-copy them if the cockpit's engine changes.

## What it does
- **Simplified profile** — birthday → four numbers only: Life Path, Day Born,
  Vietnamese/Chinese **year animal** (year only), Western sun sign.
- **Energy Maxing for the Day (free)** — a universal daily reading keyed to the
  date's universal day number; identical for everyone. Also powers the calendar.
- **Personal Guidance (paid)** — deterministic per-user daily reading: Personal
  Day (birthday + date) picks a base reading, the user's Life Path merges an
  optional overlay on top. Gated behind subscription.

## Structure
- `index.html` / `app.js` / `style.css` — the consumer UI (profile + daily).
- `emaxing-engine.js` — the deterministic engine (profile + daily readings).
  Contains no advice copy; all wording is data.
- `emaxing-content.json` — the advice content (schema in the file's `_note`).
  Free + paid tiers both authored (Manuel's voice, via the marketing session).
- `lib/` — ported math (astronomy.browser.min.js, astro-engine.js,
  numerology.js, compat-data.js, compat-engine.js).

## Preview
Serve the folder statically (any static server) and open `index.html`.
`?unlock=1` temporarily previews the paid tier (a demo flag; replaced by the
real Firebase subscription check later). `?unlock=0` clears it.

## Not built yet
- Consumer calendar page (will reuse the cockpit's calendar logic, copied).
- Auth + Stripe subscription + the Cloud Function that sets the subscription
  flag. The paid gate is currently a local demo flag only.
