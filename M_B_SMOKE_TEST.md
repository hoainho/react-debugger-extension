# M-B Manual Smoke-Test Plan

Tester runbook for someone with real Chrome + devtools extension loaded.
Extension must be built (`npm run build`) and loaded as an unpacked extension.

---

## Prerequisites

1. `npm run build` — exits 0.
2. Open `chrome://extensions`, enable **Developer mode**, load unpacked from `dist/`.
3. Open a test page running React (e.g. `http://localhost:3000` with any CRA/Vite app, or [react.dev](https://react.dev)).
4. Open Chrome DevTools → find the **React Debugger** panel tab.

---

## TC-01: Extension loads without errors

**Steps:**
1. Open a React page.
2. Open DevTools Console.
3. Check for errors from `react-debugger` or `chrome-extension://`.

**Expected:** No errors. Panel shows "React Debugger" tab.

---

## TC-02: Settings panel — detector toggles visible

**Steps:**
1. Click **Settings** tab in the React Debugger panel.
2. Observe detector list.

**Expected:**
- `reconciler-keys` listed — confidence badge `high` — toggle ON by default.
- `scan-overlay` listed — confidence badge `high` — toggle ON by default.
- `closure-leak` listed — confidence badge `medium` — toggle OFF by default.

---

## TC-03: Settings panel — toggle closure-leak ON

**Steps:**
1. In Settings, toggle `closure-leak` to ON.
2. Interact with the page (click buttons, navigate between views).
3. Wait 60 seconds.

**Expected:**
- No browser tab memory growth visible in Task Manager (drain prevents buffer from growing).
- No JS errors in Console.

---

## TC-04: Reconciler-keys detector — Math.random() key

**Steps:**
1. Load or create a React component that renders a list with `key={Math.random()}`.
   Example: `items.map(item => <div key={Math.random()}>{item}</div>)`
2. Trigger a re-render.
3. Check the React Debugger **Issues** tab.

**Expected:**
- Issue of type `UNSTABLE_LIST_KEY` appears within ~1s of the commit.
- Issue description mentions "Math.random" or "unstable key".

---

## TC-05: Reconciler-keys detector — Date.now() key

**Steps:**
1. Render a list with `key={Date.now()}`.
2. Trigger a re-render.

**Expected:** Same as TC-04 — `UNSTABLE_LIST_KEY` issue appears.

---

## TC-06: Reconciler-keys detector — numeric index reorder

**Steps:**
1. Render a list with index keys: `items.map((item, i) => <div key={i}>{item}</div>)`.
2. Trigger a reorder of items (reverse the array, for example).
3. Check Issues tab.

**Expected:** `UNSTABLE_LIST_KEY` issue appears flagging numeric-index reorder.

---

## TC-07: Scan-overlay detector — bounding rect off commit path

**Steps:**
1. Enable Performance profiling in DevTools → record a few seconds of React activity.
2. Stop recording.
3. Inspect the flame chart for `onCommitFiberRoot`.

**Expected:**
- `getBoundingClientRect` calls do NOT appear inside `onCommitFiberRoot` stack frames.
- They appear inside idle callback frames (separate from the commit stack).
- No long tasks (>50ms) attributed to the extension commit handler.

---

## TC-08: Settings migration — legacy disabled sites preserved

**Steps:**
1. Before loading the extension, manually set chrome.storage.local:
   ```js
   chrome.storage.local.set({ react_debugger_disabled_sites: ['example.com', 'foo.com'] })
   ```
2. Load the extension.
3. Go to Settings → per-site overrides.

**Expected:**
- `example.com` and `foo.com` appear in the per-site disabled list.
- No `react_debugger_disabled_sites` key remains in storage after migration
  (verify: `chrome.storage.local.get(null, console.log)` in background console).
- New key `react_debugger_settings_v1` is present.

---

## TC-09: Settings migration is idempotent

**Steps:**
1. Reload the extension (disable + re-enable in chrome://extensions).
2. Check storage again.

**Expected:** Migration does not duplicate entries. Storage state identical to post-TC-08.

---

## TC-10: Per-site override — disable on current site

**Steps:**
1. Open React Debugger panel on `localhost:3000`.
2. In Settings, add `localhost` to per-site disabled list (or click the "Disable on this site" button if present).
3. Reload the page.

**Expected:**
- Panel shows debugger is disabled for this site.
- No issues emitted.
- Other sites remain unaffected.

---

## TC-11: Closure-leak detector — no false positives on clean closures

**Steps:**
1. Enable `closure-leak` in Settings.
2. Visit a React page with normal event handlers (onClick, useEffect cleanup, etc.).
3. Interact normally for 30 seconds.
4. Check Issues tab.

**Expected:** No closure-leak issues for normal, properly-cleaned-up closures.

---

## TC-12: drainAll periodic cleanup — no memory growth

**Steps:**
1. Enable ALL detectors in Settings.
2. Open Chrome Task Manager (Shift+Esc).
3. Note the extension's memory footprint.
4. Interact with the React app for 5 minutes (navigation, clicks, etc.).
5. Check memory every 60 seconds.

**Expected:** Extension memory stays stable (±5MB). Does not grow linearly over time.

---

## Sign-off checklist

- [ ] TC-01 passed
- [ ] TC-02 passed
- [ ] TC-03 passed (no errors, no memory growth)
- [ ] TC-04 passed (UNSTABLE_LIST_KEY emitted for Math.random)
- [ ] TC-05 passed (UNSTABLE_LIST_KEY emitted for Date.now)
- [ ] TC-06 passed (UNSTABLE_LIST_KEY emitted for index reorder)
- [ ] TC-07 passed (getBoundingClientRect off commit path)
- [ ] TC-08 passed (migration from legacy format)
- [ ] TC-09 passed (migration idempotent)
- [ ] TC-10 passed (per-site disable works)
- [ ] TC-11 passed (no false positives)
- [ ] TC-12 passed (no memory growth)
