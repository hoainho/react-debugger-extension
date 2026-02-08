# Troubleshooting Guide

Solutions to common issues with React Debugger Extension.

---

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Extension Not Working](#extension-not-working)
3. [React Not Detected](#react-not-detected)
4. [Redux Not Detected](#redux-not-detected)
5. [Performance Issues](#performance-issues)
6. [Data Not Showing](#data-not-showing)
7. [Error Messages](#error-messages)

---

## Installation Issues

### NPX command fails

**Error:**
```
npm ERR! code ENOENT
npm ERR! syscall spawn
```

**Solution:**
1. Update Node.js to version 18+
2. Clear npm cache: `npm cache clean --force`
3. Try again: `npx @nhonh/react-debugger`

---

### "Permission denied" error

**Error:**
```
EACCES: permission denied
```

**Solution:**
```bash
# Use a different directory
npx @nhonh/react-debugger ~/Desktop/react-debugger

# Or fix permissions
sudo chown -R $USER ~/.npm
```

---

### Extension won't load in Chrome

**Symptoms:**
- "Load unpacked" button doesn't work
- Error: "Manifest file is missing or unreadable"

**Solutions:**

1. **Check you selected the correct folder**
   - Should contain `manifest.json`
   - Not the parent folder

2. **Re-download**
   ```bash
   rm -rf ./react-debugger
   npx @nhonh/react-debugger ./react-debugger
   ```

3. **Check Chrome version**
   - Requires Chrome 88+
   - Update if needed

---

## Extension Not Working

### Tab doesn't appear in DevTools

**Solutions:**

1. **Refresh the page** after loading extension

2. **Close and reopen DevTools** completely

3. **Check extension is enabled**
   - Go to `chrome://extensions/`
   - Ensure toggle is ON

4. **Check for conflicts**
   - Disable other React extensions temporarily
   - Especially "React Developer Tools"

---

### "Extension context invalidated" error

**Cause:** Extension was updated/reloaded while DevTools was open.

**Solution:**
1. Close DevTools
2. Close the tab
3. Reopen the page and DevTools

---

### Recording badge shows "Paused"

**Solution:**
1. Click the Start/Stop button to enable recording
2. Refresh the page
3. Check if the page has React

---

## React Not Detected

### "Waiting for React..." message

**Possible causes:**

1. **Page doesn't use React**
   - Check with: Open console, type `window.React`
   - If undefined, page isn't using React

2. **React version too old**
   - Requires React 16+ (Fiber architecture)
   - React 15 and below not supported

3. **React loaded after page**
   - Wait for full page load
   - Try refreshing

4. **Production build without DevTools**
   - Some builds strip React globals
   - Check `__REACT_DEVTOOLS_GLOBAL_HOOK__`

**Debug steps:**
```javascript
// In browser console:
console.log('React:', typeof React);
console.log('DevTools Hook:', !!window.__REACT_DEVTOOLS_GLOBAL_HOOK__);

// Find React root
const root = document.getElementById('root');
const keys = Object.keys(root);
console.log('Fiber keys:', keys.filter(k => k.includes('react')));
```

---

### Works on some sites but not others

**Possible reasons:**

1. **Shadow DOM** - React inside Shadow DOM is harder to detect

2. **Iframes** - React in iframes has separate context

3. **Server Components** - RSC in Next.js 13+ may not show client components

4. **Micro-frontends** - Multiple React instances

---

## Redux Not Detected

### Redux tab shows "Redux not detected"

**Check these in order:**

1. **Is Redux actually used?**
   ```javascript
   // In console:
   console.log(window.__REDUX_DEVTOOLS_EXTENSION__);
   console.log(window.store);
   ```

2. **Expose store for debugging**
   ```jsx
   // In your app's store setup
   const store = configureStore({ reducer: rootReducer });
   
   if (process.env.NODE_ENV === 'development') {
     window.store = store;
   }
   ```

3. **Install Redux DevTools Extension**
   - [Chrome Web Store](https://chrome.google.com/webstore/detail/redux-devtools)
   - Our extension can use its connection

4. **Use DevTools enhancer**
   ```jsx
   import { configureStore } from '@reduxjs/toolkit';
   
   // RTK automatically connects to DevTools
   const store = configureStore({
     reducer: rootReducer,
     devTools: process.env.NODE_ENV !== 'production',
   });
   ```

---

### Redux detected but state is empty

**Cause:** Store might be created but not yet populated.

**Solutions:**
1. Wait for app to initialize
2. Dispatch an action to trigger update
3. Check if store is the correct instance

---

## Performance Issues

### Extension makes page slow

**Solutions:**

1. **Pause recording** when not debugging
   - Click the Stop button

2. **Disable React Scan** when not needed
   - Visual overlay has overhead

3. **Clear old data**
   - Click "Clear" in Timeline
   - Reduces memory usage

4. **Limit history**
   - Extension keeps last 2000 events
   - Old events auto-purge

---

### DevTools panel is slow/laggy

**Solutions:**

1. **Filter events** - Show only what you need

2. **Collapse sections** - In Redux state tree

3. **Reduce timeline scope** - Clear frequently

4. **Close other DevTools tabs** - Elements, Network, etc.

---

## Data Not Showing

### Timeline is empty

**Checklist:**
- [ ] Recording is enabled (green badge)
- [ ] React is detected
- [ ] You interacted with the page
- [ ] Correct tab is selected (check tabId)

**Try:**
1. Click in the page to trigger events
2. Change state in your app
3. Check filter buttons aren't hiding events

---

### Performance metrics show N/A

**Cause:** Metrics require Navigation Timing API.

**This happens when:**
- Page is in an iframe
- Page was restored from cache
- DevTools opened after load

**Solution:** Hard refresh: `Cmd+Shift+R` / `Ctrl+Shift+R`

---

### Memory tab shows no data

**Requirements:**
- `performance.memory` API (Chrome only)
- Not available in Firefox/Safari

**Check:**
```javascript
console.log(performance.memory); // Should show object
```

---

## Error Messages

### "Cannot read property 'X' of undefined"

**Where it occurs:** Usually in Panel when data is malformed.

**Solutions:**
1. Refresh the page
2. Reload the extension
3. Report bug if persistent

---

### "Extension context invalidated"

**Cause:** Extension reloaded while DevTools open.

**Solution:**
1. Close DevTools completely
2. Refresh the page
3. Reopen DevTools

---

### "Manifest version 2 is deprecated"

**Note:** This is a warning, not an error. Extension still works.

Future versions will migrate to Manifest V3.

---

### Console errors from extension

**Safe to ignore:**
- `DevTools failed to load SourceMap`
- `Could not establish connection`

**Report if you see:**
- `Uncaught TypeError` from panel.js
- `Uncaught ReferenceError` from inject.js

---

## Still Having Issues?

### Debug Mode

Enable verbose logging:
```javascript
// In browser console
localStorage.setItem('REACT_DEBUGGER_DEBUG', 'true');
// Then refresh
```

### Collect Debug Info

When reporting a bug, include:

1. **Browser & version**
   ```
   chrome://version/
   ```

2. **Extension version**
   - Shown in header: "v1.0.0"

3. **React version**
   - Shown when detected

4. **Console errors**
   - Right-click panel → Inspect
   - Copy errors from Console

5. **Steps to reproduce**
   - What you did
   - What you expected
   - What happened

### Report a Bug

[Open an issue on GitHub](https://github.com/hoainho/react-debugger-extension/issues/new)

Include:
- Debug info above
- Screenshots if helpful
- Minimal reproduction if possible

---

## FAQ

### Q: Does this work with Next.js?

**A:** Yes! Works with any React framework:
- Next.js
- Remix
- Gatsby
- Create React App
- Vite

### Q: Does this work in Firefox?

**A:** Currently Chrome/Chromium only. Firefox support planned.

### Q: Is my data sent anywhere?

**A:** No. All data stays in your browser. The extension:
- Has no analytics
- Makes no network requests (except download)
- Stores nothing persistently

### Q: Will this slow down production?

**A:** The extension only activates in DevTools. It doesn't affect production users who don't have it installed.

### Q: Can I use this with React Native?

**A:** No. This is for React DOM (web) only.
