# Remaining & Upgraded Plan (post S0–S6)

Autonomous code (S0–S6) is committed + 453 tests green + Panel v2 wired. What's
left is (A) an **upgraded visual-design pass** (the "chưa đẹp mắt" gap), and
(B) the **human gates** that need credentials / real environments / your review.

---

## A. NEW — S4.5 · Visual Design Pass (the upgrade)

The current v2 shell only *re-groups* 9→5 and reuses the old tab CSS — it is not
a designed interface. This workstream makes it genuinely good. Each story is
autonomously buildable (CSS/components + RTL), but **you own the final visual
verdict** (I'll ship screenshots via the headless renderer for each).

Status legend: ✅ done · 🟡 partial · ⬜ open. (PRD: `openspec/prd/S4.5-visual-polish.prd.json`.)

| # | Story | Status | Notes |
|---|---|---|---|
| **V1** | Design language + shell polish | ✅ | DevTools-native tokens; 5-view nav active-underline + per-view count badges; sub-tabs as segmented control; sticky header; tabular-nums. `30580e9`. |
| **V2** | Dashboard view (real) | ✅ | `DashboardView` is now the default landing view — severity stat-tiles, React version/mode + Redux chip, render-pressure sparkline (area+line, emphasized endpoint), top-offenders, page-load vitals. `65cb536`. |
| **V3** | Card-based issue system | ✅ | Existing rich `IssueCard` moved onto the `--severity-*` token ramp (kept all content: titles, why, closure timeline, learn links); used across State/Effects tabs. `65cb536`. |
| **V4** | Profiler/State/Effects layout | ✅ | New reusable `ChartCanvas` (area/line/bars + grid + endpoint) → Memory used-heap area timeline + Performance render-distribution bars. Timeline chips de-noised. State: Redux sub-tab already a token-consistent tree/inspector split (kept, not rewritten). Effects grouped. +3 visual baselines. `8d886bd`, `<v4>`. |
| **V5** | Motion + a11y + WCAG | ✅ | Section rise+fade + card reveal; global `prefers-reduced-motion`; link focus-visible; `--text-muted` bumped to pass WCAG AA 4.5:1 (was 2.28:1). `8d886bd`. |
| **V6** | Visual regression | ✅ | Headless Playwright lane: 6 baselines (5 views + classic), `npm run test:visual`, `test/visual/README.md`. `8d886bd`. |

**Remaining under A:** none — V1–V6 all complete. (The Profiler chart-canvas shipped as a reusable `ChartCanvas`; the State inspector split was already present in the Redux tab and kept as-is rather than rewritten blind.)

**Process per story:** build → headless screenshot → you review the image → iterate.

---

## B. Human gates still open (need you / credentials / real env)

Grouped by what unblocks them:

**Credentials / outward (you run):**
- npm publish `@nhonh/react-debugger` — **blocked: token in `~/.npmrc` is expired (E401)**. Refresh (`npm login`) → I can publish. Also needs a version bump (2.1.2 is already latest).
- Deploy Cloudflare Worker (quota) + telemetry endpoint.
- Chrome Web Store submit + review · GitHub release · Show HN / Product Hunt.

**Real users / time (can't be faked):**
- Recruit 10–20 alpha testers · **G1 kill-gate** (a week of real usage) — you said skip for now.

**Live-environment verification (need a real React app / browser):**
- Run the Playwright MCP e2e against a loaded extension (I verified the bridge headless already).
- R2: migrate + delete the 3 legacy monolith walkers onto `walkFiber` (needs live-React regression).
- Live BYOK network calls (OpenAI/Anthropic) · React 19.2 Performance-Tracks live API · chrome.debugger source-map resolution.

**Deferred detector:**
- `useFormStatus-outside-form` quick-win (needs fiber form-ancestry — was FP-prone from source; do it fiber-based like inline-handler-cost).

---

## C. Release path (S7) — after A + your gates

1. Merge stack → `main` (ff, linear: S0→S6 + the 2 fixes + S4.5).
2. Bump `2.0.3 → 3.0.0`, cut `CHANGELOG [Unreleased] → [3.0.0]`.
3. Regression + visual baselines green → CWS submit → npm promote → tag → announce.

---

## Recommended order
**S4.5 V1–V4 first** (design language + dashboard + cards + shell — the biggest visible win), then V5–V7, then the release path. I can start V1 now and hand you a screenshot to react to.
