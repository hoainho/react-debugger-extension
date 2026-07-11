# Visual regression (S4.5 V6)

Per-view screenshot baselines for the redesigned 5-view panel, using
Playwright's built-in `toHaveScreenshot`. The panel's built `dist/` assets are
served from disk (route-fulfill) and `chrome.*` is stubbed with deterministic
fixture data — no unpacked extension or MCP bridge required, so this lane runs
standalone and offline.

## Run

```bash
npm run build          # baselines render the built panel — build first
npm run test:visual    # compare current render against committed baselines
```

## Update baselines (after an intentional UI change)

```bash
npm run build
npm run test:visual -- --update-snapshots
```

Review the regenerated PNGs in `panel.visual.spec.ts-snapshots/` before
committing them.

## Coverage

One baseline per view — Dashboard, Profiler, State, Effects, Settings — plus the
classic layout.

## Notes

- Baselines are **platform-suffixed** (`…-darwin.png`). Font rendering differs
  across OS/arch, so regenerate on the same platform CI uses (or add a
  Linux-baseline generation step in CI).
- Tolerance: `maxDiffPixelRatio: 0.02`, animations disabled, reduced-motion +
  dark color-scheme forced for determinism (see `playwright-visual.config.ts`).
- Config is separate from `playwright.config.ts` (the RDBG_E2E MCP lane) so the
  two never interfere.
