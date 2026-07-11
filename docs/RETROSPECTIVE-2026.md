# 2026 Retrospective — H2 Roadmap (react-debugger-extension)

Summary of the H2-2026 roadmap execution (stages S0–S6), what shipped, what was
gated to the maintainer, and the 2027 kickoff topics.

## What shipped

| Stage | Theme | Highlights |
|---|---|---|
| **S0** | Close-out M-B | reconciler-keys fixtures + perf baseline; detector registry + hero #1 finalized |
| **S1** | MCP Server v1 | Node WS bridge (127.0.0.1 + token/Origin handshake), stdio MCP server, options-page deep-link pairing (storage.session), SW client backoff/keepalive, 6 tool contracts + error codes + secret redaction, threat model, Playwright e2e scaffold |
| **S2** | M-C hydration + perf infra | **Hero #2 hydration-mismatch**, WeakMap state-name cache, fair-share budget allocator (yield/resume), source-map helper |
| **S3** | M-D | **Hero #3 context-cascade**, stale-closure-async v2, **BYOK AI providers** (Hosted/OpenAI/Anthropic), unified `walkFiber` traversal core, session snapshot-persistence |
| **S4** | UI redesign core | Fixed 29 long-standing UI-panel test failures → full suite green; design tokens + CSS Modules; Button/Card/Tooltip/Badge; 9→5 view map behind a classic-mode flag; MCP pairing + snapshot wiring |
| **S5** | M-E | **Hero #4 suspense-waterfall**; production-capability matrix; React 19.2 Performance-Tracks version gate |
| **S6** | M-F | Quick-win detectors (inline-handler-cost, ref-mutation-during-render); opt-in anonymous telemetry (payload-audited, no PII); this retrospective |

**All four hero detectors shipped**: reconciler-keys, hydration-mismatch, context-cascade, suspense-waterfall — plus the MCP server, BYOK AI, and the UI-redesign foundation. Nine detectors registered. Full unit/integration suite green throughout.

## Gated to the maintainer (human gates — prepped, never auto-executed)

- **Release (S7)**: cut `3.0.0`, promote npm `alpha`→`latest`, submit to Chrome Web Store, GitHub release, Show HN / Product Hunt.
- **MCP alpha**: recruit 10–20 testers, publish npm `alpha`, deploy the Worker (quota), the **G1 kill-gate decision** (needs a week of real usage), run the Playwright e2e against a loaded extension.
- **BYOK**: live OpenAI/Anthropic network calls.
- **R2**: migrate + delete the 3 legacy monolith walkers onto `walkFiber` (needs live-React regression).
- **UI**: the 5-view Panel layout render, animations, WCAG-contrast/visual audit, visual-regression baselines.
- **M-E.2 / M-C.3**: the live React 19.2 Performance-Tracks API + chrome.debugger source-map resolution.
- **Telemetry**: deploy the append-only Worker endpoint.

## 2027 kickoff topics

- Detector plugin SDK (third-party detectors on the registry contract).
- Firefox port.
- Onboarding / first-run experience.
- Post-alpha MCP v2 (write tools + subscriptions) if the G1 gate passes.
- Complete the R2 walker migration and the UI-redesign visual layer under design review.
