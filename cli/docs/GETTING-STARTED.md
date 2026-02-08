# Getting Started with React Debugger

This guide walks you through installing and using the React Debugger extension for the first time.

---

## Table of Contents

1. [Installation](#installation)
2. [Loading the Extension](#loading-the-extension)
3. [First Time Setup](#first-time-setup)
4. [Understanding the Interface](#understanding-the-interface)
5. [Your First Debug Session](#your-first-debug-session)

---

## Installation

### Method 1: NPX (Recommended)

The fastest way to get started:

```bash
npx @nhonh/react-debugger
```

You'll be prompted to choose an installation directory:

```
┌  React Debugger Extension Installer
│
◆  Where should we install the extension?
│  ./react-debugger
│
◇  Downloading extension...
│
└  Success!
```

### Method 2: Direct Path

Skip the prompt by specifying the path:

```bash
npx @nhonh/react-debugger ./my-react-debugger
```

### Method 3: Global Install

Install globally to use anywhere:

```bash
npm install -g @nhonh/react-debugger
react-debugger ./my-extension
```

---

## Loading the Extension

### Chrome / Brave / Edge

1. **Open Extensions Page**
   - Chrome: `chrome://extensions/`
   - Brave: `brave://extensions/`
   - Edge: `edge://extensions/`

2. **Enable Developer Mode**
   
   Toggle the "Developer mode" switch in the top-right corner.

   ![Developer Mode](https://raw.githubusercontent.com/hoainho/react-debugger-extension/main/docs/images/developer-mode.png)

3. **Load the Extension**
   
   Click "Load unpacked" and select your installation folder.

   ![Load Unpacked](https://raw.githubusercontent.com/hoainho/react-debugger-extension/main/docs/images/load-unpacked.png)

4. **Verify Installation**
   
   You should see "React Debugger" in your extensions list.

   ![Extension Loaded](https://raw.githubusercontent.com/hoainho/react-debugger-extension/main/docs/images/extension-loaded.png)

---

## First Time Setup

### Opening the Debugger

1. Navigate to any React website (e.g., [react.dev](https://react.dev))
2. Open DevTools:
   - **Mac**: `Cmd + Option + I`
   - **Windows/Linux**: `F12` or `Ctrl + Shift + I`
3. Find the **"React Debugger"** tab in DevTools

![DevTools Tab](https://raw.githubusercontent.com/hoainho/react-debugger-extension/main/docs/images/devtools-location.png)

### Initial State

When you first open the debugger on a React page:

- ✅ **"Recording"** badge appears - the debugger is active
- ✅ **React version** is displayed in the header
- ✅ **Timeline** starts collecting events

If you see **"Waiting for React..."**, the page either:
- Doesn't use React
- Uses React < 16 (not supported)
- Is still loading

---

## Understanding the Interface

### Header Section

```
┌─────────────────────────────────────────────────────┐
│ ⚛️ React Debugger  v1.0.0    [Recording] [Redux]   │
│                                          [▶ Start] │
└─────────────────────────────────────────────────────┘
```

| Element | Description |
|---------|-------------|
| Version | Extension version |
| Recording | Green = active, Gray = paused |
| Redux | Appears if Redux store detected |
| Start/Stop | Toggle debugging on/off |

### Tab Bar

```
┌──────────┬───────────┬─────────────┬────────┬─────────────┬─────┬───────┐
│ Timeline │ UI & State│ Performance │ Memory │ Side Effects│ CLS │ Redux │
└──────────┴───────────┴─────────────┴────────┴─────────────┴─────┴───────┘
```

Each tab shows a badge with issue count when problems are detected.

### Status Indicators

| Color | Meaning |
|-------|---------|
| 🟢 Green | Good / No issues |
| 🟡 Yellow | Warning / Needs attention |
| 🔴 Red | Error / Critical issue |
| 🔵 Blue | Informational |

---

## Your First Debug Session

Let's debug a simple React app to understand how the extension works.

### Step 1: Open a React App

For testing, use any of these:
- Your local development server
- [react.dev](https://react.dev)
- [CodeSandbox React template](https://codesandbox.io/s/new)

### Step 2: Check the Timeline

1. Click the **Timeline** tab
2. Interact with the page (click buttons, type in inputs)
3. Watch events appear in real-time

**What you'll see:**

| Icon | Event Type | Example |
|------|------------|---------|
| 🔄 | Render | Component mounted or updated |
| 📦 | State | useState or Redux state changed |
| ⚡ | Effect | useEffect ran or cleaned up |
| ❌ | Error | JavaScript error occurred |

### Step 3: Find Issues

1. Click the **UI & State** tab
2. If issues exist, they appear as cards
3. Click a card to expand details

**Example issue:**

```
⚠️ INDEX_AS_KEY
Component: TodoList
Message: Using array index as key can cause issues with list reordering

Suggestion: Use a unique identifier from your data as the key prop

Code:
  {items.map((item, index) => (
    <li key={index}>{item}</li>  // ← Problem here
  ))}
```

### Step 4: Check Performance

1. Click the **Performance** tab
2. Look at the statistics dashboard
3. Check "Top Re-rendering Components"

**What to look for:**

| Metric | Good | Investigate |
|--------|------|-------------|
| Avg Render Time | < 16ms | > 16ms |
| Renders per component | < 10 | > 20 |
| Slow Renders | 0 | > 0 |

### Step 5: Enable React Scan (Visual Mode)

1. In **Performance** tab, find "React Scan"
2. Toggle it ON
3. Go back to your page - components flash colors on render

**Color meanings:**

| Color | Renders | Action |
|-------|---------|--------|
| 🟢 Green | 1 | Normal |
| 🟡 Yellow | 2-3 | Monitor |
| 🟠 Orange | 4-5 | Investigate |
| 🔴 Red | 10+ | Optimize! |

---

## Next Steps

Now that you understand the basics:

1. **[Read the Tabs Guide](./TABS-GUIDE.md)** - Deep dive into each tab's features
2. **[Check Troubleshooting](./TROUBLESHOOTING.md)** - If something isn't working
3. **Experiment!** - The best way to learn is by debugging real issues

---

## Quick Reference

### Keyboard Shortcuts

| Action | Mac | Windows |
|--------|-----|---------|
| Open DevTools | `Cmd + Option + I` | `F12` |
| Refresh page | `Cmd + R` | `Ctrl + R` |
| Hard refresh | `Cmd + Shift + R` | `Ctrl + Shift + R` |

### Useful Test Sites

| Site | What to Test |
|------|--------------|
| [react.dev](https://react.dev) | General React detection |
| [redux.js.org](https://redux.js.org) | Redux detection |
| [Next.js docs](https://nextjs.org/docs) | SSR React app |
| Your local app | Real issues! |

---

## Need Help?

- 📖 [Full Documentation](https://github.com/hoainho/react-debugger-extension#readme)
- 🐛 [Report a Bug](https://github.com/hoainho/react-debugger-extension/issues)
- 💬 [Discussions](https://github.com/hoainho/react-debugger-extension/discussions)
