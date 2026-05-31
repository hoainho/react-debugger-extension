# Contributing to react-debugger-extension

Thanks for your interest in improving react-debugger-extension. This guide walks you from a fresh clone to a merged PR.

## Code of Conduct

This project adopts the [Contributor Covenant v2.1](CODE_OF_CONDUCT.md). By participating, you agree to uphold it. Report unacceptable behavior to **hoainho.work@gmail.com**.

## How to set up the project locally

You need **Node 20+** and **Chrome 122+**.

```bash
git clone https://github.com/hoainho/react-debugger-extension.git
cd react-debugger-extension
npm ci
npm run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

The "React Debugger" tab appears in Chrome DevTools (`F12`) on any React 16+ page.

For active development, use the watch script — it rebuilds on every change:

```bash
npm run dev
```

After each rebuild you must click the refresh icon on the extension card in `chrome://extensions/` and reload the inspected page.

## How to run tests

```bash
npm run test:run        # one-shot run (CI-style)
npm test                # watch mode
npm run test:coverage   # with coverage report
```

> ⚠️ **Known test debt:** 29 of 170 tests currently fail because they assert against emoji characters (e.g. `'✅'`) that were removed in v2.0.0 when the UI moved to CSS badges (see [CHANGELOG v2.0.0](../CHANGELOG.md)). This is tracked as a follow-up cleanup task and **does not block your PR** — CI flags these as a separate "test debt" warning rather than gating merge. If you want a great first contribution, fix one of these test files (they're in `src/__tests__/*.test.tsx`).

## How to find a good first issue

We label scoped, well-described issues with [`good first issue`](https://github.com/hoainho/react-debugger-extension/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) and [`help wanted`](https://github.com/hoainho/react-debugger-extension/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).

Each issue includes:

- **Context** — what the issue is and why it matters
- **Where to look** — exact file paths + relevant spec scenarios
- **Expected outcome** — measurable deliverables
- **Estimated effort** — `S (1-2h)`, `M (3-6h)`, or `L (6-12h)`
- **How to claim** — comment `@hoainho I'll take this` to claim it
- **Acceptance criteria** — testable assertions for review

If a `good first issue` has been open for 10 days without a claim, it's likely the description has friction we missed — please open a Discussion to ask for clarity instead of staying silent.

## PR conventions

### Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(scope): add new feature`
- `fix(scope): fix a user-visible bug`
- `perf(scope): performance improvement`
- `docs: documentation only`
- `refactor: code change with no behavior change`
- `test: add or fix tests`
- `chore: tooling, deps, build config`

The `scope` should match a top-level directory (`panel`, `inject`, `content`, `background`, `services`, `worker`, `cli`).

### Branch naming

- `feat/<short-description>` for features
- `fix/<short-description>` for bugfixes
- `docs/<short-description>` for docs
- `chore/<short-description>` for everything else

### PR description

Use the [PR template](PULL_REQUEST_TEMPLATE.md) — it auto-loads when you open a PR. Required fields:

- Linked issue (`Closes #N`)
- Type of change (bug / feature / perf / docs / refactor)
- Testing notes (commands run + results)
- CHANGELOG entry under `## [Unreleased]` (for user-visible changes)

### What we expect

- **CI passes** — the [PR validation workflow](workflows/ci.yml) runs `npm ci` + `npm run build` + `npm run test:run` on every PR. The build must be green. Test failures are evaluated case-by-case (see "Known test debt" above).
- **Small, focused changes** — one logical change per PR. Split larger work into stacked PRs.
- **Update CHANGELOG** — user-visible changes go under `## [Unreleased]` in `CHANGELOG.md`.
- **No new dependencies without discussion** — open a Discussion first if you want to add a runtime dependency.

## Maintainer SLA

I aim to review PRs **within 7 days** of opening. If I haven't responded in **14 days**, ping me on the PR (`@hoainho friendly bump`). This isn't a CI/CD shop with multiple maintainers — please be patient, but don't suffer in silence.

For security issues, see [SECURITY.md](../SECURITY.md) — don't open public issues for vulnerabilities.

## Architecture quick tour

The extension has **4 runtime contexts** that communicate via Chrome's message-passing layer:

- **`src/inject/index.ts`** (page world) — hooks React's `__react_devtools_global_hook__`, walks the fiber tree, probes Redux. Runs in the page's JS context.
- **`src/content/index.ts`** (content script) — bridges page world ↔ extension; runs at `document_start`.
- **`src/background/index.ts`** (service worker) — message router; dies after 30s idle (Manifest v3).
- **`src/panel/`** (DevTools panel) — React UI with 8 tabs (Timeline, UI&State, Performance, Memory, Side Effects, CLS, Redux, AI Analysis).

Plus two supporting surfaces:

- **`worker/`** — Cloudflare Worker validating AI Analysis subscription keys.
- **`cli/`** — the `@nhonh/react-debugger` npm package that downloads + installs the extension.

If your contribution touches multiple contexts, mention which ones in the PR description so reviewers know what to verify.

## Questions?

Open a [Discussion](https://github.com/hoainho/react-debugger-extension/discussions). General usage questions go there; bug reports and feature requests go in [Issues](https://github.com/hoainho/react-debugger-extension/issues/new/choose).
