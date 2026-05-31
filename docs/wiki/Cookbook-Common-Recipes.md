# Cookbook: Common Recipes

Step-by-step debugging workflows for typical React bugs. Each recipe names: the symptom, which tab to use, what to look for, and the fix.

> Found a recipe missing? Add it here, or [share it in Show & Tell](https://github.com/hoainho/react-debugger-extension/discussions/new?category=show-and-tell) and a maintainer will fold it in.

## Recipe 1: "My page is laggy and I don't know why"

**Symptom:** Page feels slow, especially on interaction. Chrome's Performance tab shows yellow/red regions but doesn't say *which React component* is responsible.

**Tab to use:** Performance

**Workflow:**

1. Open DevTools → React Debugger tab → Performance sub-tab
2. Reproduce the lag (e.g., type in the search box, click a button)
3. Look at "Top Re-rendering Components" — the top 3 are your suspects
4. Click into a row → expand to see render reason (`props changed`, `state changed`, `context changed`)
5. If "props changed" — open the Redux tab and check if a selector is returning a new reference on every dispatch
6. If "state changed" — open the Timeline tab and find the `setState` call

**Fix patterns:**
- For Redux: add `shallowEqual` to `useSelector`, or memoize the selector with `createSelector`
- For local state: wrap the child component in `React.memo` if the parent re-renders frequently
- For context: split the context into smaller contexts that change less often

---

## Recipe 2: "I have a memory leak"

**Symptom:** Memory usage grows over time, especially on long-lived pages (dashboards, chat apps). Refreshing the page resets it; navigating doesn't.

**Tab to use:** Memory + Side Effects

**Workflow:**

1. Open DevTools → React Debugger tab → Memory sub-tab
2. Note the current heap size baseline
3. Interact with the app for 60 seconds — do the things that should trigger the leak (open/close modals, switch tabs, etc.)
4. Watch the heap-size sparkline:
   - If it grows linearly and never recovers → likely a leak
   - If it spikes and recovers → normal GC, not a leak
5. Switch to Side Effects tab → look for "missing cleanup" warnings
6. The leak is usually a `setInterval` / event listener / subscription that wasn't cleaned up

**Fix pattern:**
```tsx
useEffect(() => {
  const id = setInterval(handler, 1000);
  return () => clearInterval(id);  // ← this is what was missing
}, []);
```

---

## Recipe 3: "An action is dispatched but UI doesn't update"

**Symptom:** Clicked a button, Redux DevTools shows the action fired, but the component doesn't re-render.

**Tab to use:** Redux + Performance

**Workflow:**

1. Open Redux tab → confirm the action appears in the action history
2. Expand the action → check the "state diff" — did the state actually change?
3. If state DIDN'T change → your reducer returned the same reference. Check for mutation:
   ```js
   // ❌ MUTATION — same reference, no re-render
   case 'add': state.items.push(action.payload); return state;
   // ✅ NEW REFERENCE — re-render triggers
   case 'add': return { ...state, items: [...state.items, action.payload] };
   ```
4. If state DID change → switch to Performance tab → check if the component re-rendered. If not, your `useSelector` may have a referential-equality issue (returning a new object slice each time, defeating React's bailout).

---

## Recipe 4: "Cumulative Layout Shift score is high in Lighthouse"

**Symptom:** Lighthouse reports a CLS score >0.1. You need to find which element is shifting.

**Tab to use:** CLS

**Workflow:**

1. Open DevTools → React Debugger → CLS tab BEFORE loading the page (or refresh after opening)
2. Watch the live CLS score climb
3. Look at "Top Shift Contributors" — sorted by impact score
4. Each contributor names the DOM element causing the shift
5. Common culprits:
   - `<img>` without explicit `width`/`height` (image loads, page reflows)
   - Web fonts without `font-display: optional` (FOIT/FOUT shifts)
   - Late-injecting ad/embed iframes
   - Dynamic content (e.g., "Welcome back, Alice" replaces a skeleton)

**Fix patterns:**
- Always set `width` and `height` on `<img>` (CSS can override but the attribute hints layout)
- Reserve space for dynamic content with a skeleton of the same height
- Use `aspect-ratio` CSS for responsive images
- Defer non-critical embeds below the fold

---

## Recipe 5: "useEffect ran twice in development"

**Symptom:** A `console.log` inside `useEffect(() => {...}, [])` appears twice on mount.

**Tab to use:** None — this is React's `StrictMode` doing its job

**Workflow:**

1. Check `src/index.tsx` (or equivalent) for `<React.StrictMode>` wrapping `<App />`
2. If present: the double-mount is **intentional in development** to surface effect-cleanup bugs (React docs: "If your Effect breaks because of re-mounting, you need to implement a cleanup function.")
3. In production builds, StrictMode is a no-op — the effect runs once

**Fix pattern:** Don't remove StrictMode. Instead, make your effect idempotent or add a cleanup that undoes the setup:

```tsx
useEffect(() => {
  const subscription = subscribeToFoo();
  return () => subscription.unsubscribe();
}, []);
```

If you DO need to suppress for a fixture or e2e test, omit StrictMode from that specific tree (e.g., test fixtures) — never from the main app.

---

## Recipe 6: "Component renders 47 times in 1 second and I can't tell why"

**Symptom:** Performance tab shows a single component re-rendering dozens of times per second.

**Tab to use:** Performance + Timeline

**Workflow:**

1. Performance tab → find the high-render component → note the count
2. Click into it → look at "Render reason" for each render
3. If reason is "state changed" → there's a `setState` in an effect with a missing dep
4. If reason is "props changed" → trace upward via the Owner Stack (planned for v2.3; for now use React DevTools' parent navigation)
5. If reason is "context changed" → the context is updating too often; split it

**Common cause:** `setState` in a `useEffect` without deps, or with an unstable dep:

```tsx
// ❌ Infinite loop
const [count, setCount] = useState(0);
useEffect(() => {
  setCount(count + 1);  // Triggers re-render → effect runs again → setCount → ...
});

// ❌ Same problem, more subtle
useEffect(() => {
  setData(processData(rawData));
}, [rawData, processData]);  // processData is redeclared every render!

// ✅ Fix
const memoizedProcess = useCallback(processData, []);
useEffect(() => {
  setData(memoizedProcess(rawData));
}, [rawData, memoizedProcess]);
```

---

## Recipe 7: "AI Analysis says 'security risk' but I don't see it"

**Symptom:** AI Analysis tab flags a security issue, but you can't tell what file/line is affected.

**Tab to use:** AI Analysis + your editor

**Workflow:**

1. AI Analysis tab → click into the flagged item
2. Expand "Affected components" — these are the React component display names
3. Search your codebase for those component names
4. Read the AI's "Suggestion" field — usually names a specific pattern (e.g., "dangerouslySetInnerHTML with unsanitized user input", "fetching without await")
5. If the suggestion is vague, regenerate the analysis after a fresh page load — the snapshot may have been incomplete

**Honest caveat:** AI Analysis can hallucinate. Treat it as a *prompt for investigation*, not gospel. If you can't reproduce the issue manually, it might be a false positive — and we'd love a bug report with the analysis JSON attached.

---

## Contributing a recipe

Got a debugging workflow that surfaced a non-obvious bug? Add it here:

1. Click "Edit" on this wiki page (collaborator access required — comment in [Discussions](https://github.com/hoainho/react-debugger-extension/discussions) if you want collaborator access)
2. Add your recipe at the bottom in the same format
3. The maintainer will review and may reorder for prominence

Or, lower-friction route: [share it in Show & Tell](https://github.com/hoainho/react-debugger-extension/discussions/new?category=show-and-tell) and we'll fold it in.
