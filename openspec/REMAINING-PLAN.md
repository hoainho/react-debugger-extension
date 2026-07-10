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

| # | Story | Concrete upgrade |
|---|---|---|
| **V1** | **Design language** | Commit to a direction (DevTools-native dark, dense, information-first). Refine tokens: a *chosen* blue-biased neutral ramp (not flat grey), one accent, semantic severity ramp (error/warn/info/ok) separate from accent, an 8pt spacing rhythm, a 1.2 type scale (12/13/15/18/22), tabular-nums for all metrics. |
| **V2** | **Dashboard view (real)** | Replace the empty AI-only Dashboard with a KPI row: issue counts by severity (colored stat tiles), React version + mode chip, render-pressure sparkline, "top offender" component. Cards, not tables. |
| **V3** | **Card-based issue system** | Redesign `IssueCard` on the token system: severity left-stripe + badge, collapsed = title + component + count, expanded = suggestion/code/location. Consistent across all views. Empty states with guidance, not blank. |
| **V4** | **5-view shell polish** | Real nav (icon + label + count badge), active-state treatment, the sub-tab strip as a segmented control (not reused tab CSS), sticky header, content max-width + breathing room, loading skeletons. |
| **V5** | **Profiler / State / Effects layout** | Profiler: timeline/renders/memory as a segmented control over a shared chart canvas (area fill, faint grid, emphasized endpoint — per dataviz). State-viewer: merged UI+State+Redux with a tree/inspector split. |
| **V6** | **Motion + a11y + polish** | Tasteful transitions (view switch, card expand), `prefers-reduced-motion`, WCAG 2.1 AA contrast audit on the new palette, focus-visible rings, keyboard nav on the 5-view + sub-tabs. |
| **V7** | **Visual regression** | Playwright screenshot baselines per view (headless) so future changes are caught. Verified in a real browser. |

**Process per story:** build → headless screenshot → you review the image → iterate. This closes the "I can't verify visual quality" gap by putting a real rendered image in front of you each step.

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
