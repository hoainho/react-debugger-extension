# Screenshots Guide

Upload these screenshots to `docs/images/` folder for documentation.

## Required Screenshots

### Main Screenshots (High Priority)

| # | Filename | Description | How to capture |
|---|----------|-------------|----------------|
| 1 | `preview.png` | Main extension preview | Full DevTools panel with Timeline tab showing data |
| 2 | `install-cli.png` | CLI installation | Run `npx @nhonh/react-debugger` and capture terminal output |

### Chrome Setup Screenshots

| # | Filename | Description | How to capture |
|---|----------|-------------|----------------|
| 3 | `chrome-load.png` | Chrome extensions page | `chrome://extensions/` with Developer mode ON |
| 4 | `devtools-tab.png` | React Debugger tab location | DevTools toolbar showing the tab |
| 5 | `devtools-location.png` | Where to find the tab | Arrow pointing to tab in DevTools |
| 6 | `developer-mode.png` | Developer mode toggle | Close-up of the toggle |
| 7 | `load-unpacked.png` | Load unpacked button | Close-up of the button |
| 8 | `extension-loaded.png` | Extension in list | Extension card in extensions page |

### Tab Screenshots (All 7 Tabs)

| # | Filename | Description | What to show |
|---|----------|-------------|--------------|
| 9 | `timeline-tab.png` | Timeline tab | Multiple events: renders, state changes, effects |
| 10 | `ui-state-tab.png` | UI & State tab | Show 2-3 issues (INDEX_AS_KEY, MISSING_KEY, etc.) |
| 11 | `performance-tab.png` | Performance tab | Stats dashboard + Top Re-rendering Components table |
| 12 | `memory-tab.png` | Memory tab | Memory chart with history + health indicators |
| 13 | `side-effects-tab.png` | Side Effects tab | Show MISSING_CLEANUP or STALE_CLOSURE issues |
| 14 | `cls-tab.png` | CLS tab | CLS score + Top Shift Sources table |
| 15 | `redux-tab.png` | Redux tab | State tree expanded + Action History + Dispatcher |

## Recommended Size

- **Width:** 800-1200px
- **Format:** PNG
- **Retina:** 2x if possible

## How to Capture

### Mac
- `Cmd + Shift + 4` → Select area
- `Cmd + Shift + 4 + Space` → Capture window

### Windows
- `Win + Shift + S` → Snipping tool
- Or use Snagit/Greenshot

### Chrome DevTools
1. Open DevTools on a React site
2. Navigate to React Debugger tab
3. Interact to generate data
4. Capture the panel

## Tips

1. **Use a real React app** - Shows realistic data
2. **Clean up sensitive data** - Blur if needed
3. **Consistent sizing** - Same window size for all
4. **Light theme** - Better for docs (or provide both)

---

## Checklist

Use this to track your progress:

```
Main Screenshots:
[ ] preview.png
[ ] install-cli.png

Chrome Setup:
[ ] chrome-load.png
[ ] devtools-tab.png
[ ] devtools-location.png
[ ] developer-mode.png
[ ] load-unpacked.png
[ ] extension-loaded.png

Tab Screenshots:
[ ] timeline-tab.png
[ ] ui-state-tab.png
[ ] performance-tab.png
[ ] memory-tab.png
[ ] side-effects-tab.png
[ ] cls-tab.png
[ ] redux-tab.png
```

---

## Quick Capture Guide

### For Each Tab Screenshot:

1. **Timeline Tab** (`timeline-tab.png`)
   - Click around in a React app to generate renders
   - Show mix of render (🔄), state (📦), effect (⚡) events
   - Have some events expanded

2. **UI & State Tab** (`ui-state-tab.png`)
   - Need a React app with issues (use index as key, etc.)
   - Show 2-3 different issue types
   - Have one issue expanded to show details

3. **Performance Tab** (`performance-tab.png`)
   - Show the statistics dashboard at top
   - Have data in "Slowest Components" table
   - Have data in "Top Re-rendering Components" table

4. **Memory Tab** (`memory-tab.png`)
   - Click "Start Monitoring" first
   - Wait for chart to have some data points
   - Show health indicator (green/yellow/red)

5. **Side Effects Tab** (`side-effects-tab.png`)
   - Need an app with useEffect issues
   - Show MISSING_CLEANUP or MISSING_DEP
   - Have one issue expanded

6. **CLS Tab** (`cls-tab.png`)
   - Load a page with layout shifts (images without dimensions)
   - Show CLS score
   - Show "Top Shift Sources" table with entries

7. **Redux Tab** (`redux-tab.png`)
   - Need a Redux app (or expose window.store)
   - Expand some state tree nodes
   - Show Action History with some actions
   - Show the Action Dispatcher section

### Test Apps for Screenshots

| Feature | Test Site |
|---------|-----------|
| React detection | https://react.dev |
| Redux | Your own Redux app |
| Performance issues | App with many re-renders |
| CLS | Page with images without dimensions |
| Side Effects | App with setInterval without cleanup |
