# React Debugger - Chrome Extension

[![npm version](https://img.shields.io/npm/v/react-debugger.svg)](https://www.npmjs.com/package/react-debugger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hoainho/react-debugger-extension)

**Author:** NhoNH  
**Version:** 2.0.2  
**License:** MIT

Advanced debugging & performance optimization tool for ReactJS applications.

## Demo

[![React Debugger Demo](https://raw.githubusercontent.com/hoainho/react-debugger-extension/main/docs/video/react-ext-demo.gif)](https://raw.githubusercontent.com/hoainho/react-debugger-extension/main/docs/video/react-ext-demo-3x.mp4)

## Features

- **UI & State Issues** - Detect direct state mutation, missing keys, index as key
- **Performance Analysis** - Track re-renders, identify excessive renders
- **Side Effects** - Find missing cleanup, dependency issues in useEffect
- **CLS Monitor** - Track Cumulative Layout Shift in real-time
- **Redux DevTools** - View state tree, dispatch actions manually
- **Timeline** - Visual timeline of all React events
- **Memory** - Monitor memory usage and detect leaks
- **AI Analysis** [NEW] - AI-powered code analysis with security, performance, and crash risk detection

### v2.0.0 Highlights

- **AI Analysis Tab** - Analyze your React application with AI to identify security vulnerabilities, performance bottlenecks, and crash risks. 3 free analyses included; unlimited with a subscription key.
- **Subscription System** - Enter a subscription key to unlock unlimited AI analysis. Keys are validated remotely via a secure Cloudflare Worker.
- **UI Overhaul** - Redesigned dark blue theme with CSS badge indicators replacing all emojis for a cleaner, more professional look.
- **New Exclusive Logo** - Custom-designed logo with broken orbital rings, hexagonal core, and diagnostic crosshair.

---

## Installation

### Option 1: Quick Install via NPX (Recommended)

```bash
npx react-debugger
```

Then load the extension in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the downloaded folder

### Option 2: Build from Source

```bash
git clone https://github.com/nhonh/react-debugger-extension.git
cd react-debugger-extension
npm install
npm run build
```

Then load the `dist` folder in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist` folder

### Option 3: Download ZIP from Releases

1. Download `react-debugger.zip` from [GitHub Releases](https://github.com/nhonh/react-debugger-extension/releases)
2. Extract the ZIP
3. Load the extracted folder in Chrome as above

---

## How to Test

### Step 1: Open a React Application

Test on any React website or local development server:

- https://react.dev (official React docs)
- https://reactjs.org
- Any local React app (Create React App, Next.js, Vite, etc.)

### Step 2: Open DevTools

1. Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
2. Find the **"React Debugger"** tab in the DevTools panel tabs

### Step 3: Explore Features

#### UI & State Tab

- Shows issues with state management and list keys
- Click on any issue to expand details
- Follow suggestions to fix problems

#### Performance Tab

- Shows component render statistics
- Lists top re-rendering components
- Identifies render triggers (props, state, context)

#### Side Effects Tab

- Lists useEffect issues
- Identifies missing cleanup functions
- Shows dependency problems

#### CLS Tab

- Real-time CLS score monitoring
- Shows top layout shift contributors
- Timeline of shift events

#### Redux Tab

- View Redux state tree (if Redux is detected)
- See action history
- Dispatch custom actions for testing

#### AI Analysis Tab

- Select an AI model (GPT-4o, Claude, Gemini, etc.)
- Click "Analyze" to get AI-powered insights
- View categorized results: Security, Performance, Crash Risk
- 3 free analyses per session; unlock unlimited with a subscription key

---

## Test Scenarios

### Test 1: Missing Key Detection

Create a React app with this code:

```jsx
function App() {
  const items = ['a', 'b', 'c'];
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{item}</li>  {/* Using index as key - will be flagged */}
      ))}
    </ul>
  );
}
```

**Expected:** Warning about using index as key in UI & State tab.

### Test 2: Excessive Re-renders

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  // This will cause excessive renders
  useEffect(() => {
    const id = setInterval(() => setCount((c) => c + 1), 100);
    return () => clearInterval(id);
  }, []);

  return <div>{count}</div>;
}
```

**Expected:** Warning about excessive re-renders in Performance tab.

### Test 3: Missing Cleanup

```jsx
function Timer() {
  useEffect(() => {
    const id = setInterval(() => {
      console.log("tick");
    }, 1000);
    // Missing: return () => clearInterval(id);
  }, []);

  return <div>Timer</div>;
}
```

**Expected:** Warning about missing cleanup in Side Effects tab.

### Test 4: Layout Shift

Load a page with images without dimensions:

```html
<img src="large-image.jpg" />
<!-- No width/height -->
```

**Expected:** CLS score > 0 shown in CLS tab when image loads.

---

## Development

### Setup

```bash
npm install
```

### Build for production

```bash
npm run build
```

### Watch mode (auto-rebuild)

```bash
npm run dev
```

### Package for distribution

```bash
npm run package
```

---

## Project Structure

```
react-debugger-extension/
    src/
        background/     # Service worker
        content/        # Content script (CLS monitoring)
        inject/         # Page script (React fiber hook)
        devtools/       # DevTools page entry
        panel/          # React panel UI
            components/   # Reusable components
            tabs/         # Tab content components (8 tabs incl. AI Analysis)
            styles/       # CSS styles
        services/       # AI client, token optimizer, snapshot builder
        types/          # TypeScript types
        utils/          # Utility functions
    public/
        manifest.json   # Extension manifest
        icons/          # Extension icons (custom logo)
    dist/             # Build output (load this in Chrome)
```

---

## Troubleshooting

### Extension not showing in DevTools?

1. Make sure you loaded the `dist` folder (not the root)
2. Refresh the page after loading extension
3. Check for errors in `chrome://extensions/`

### React not detected?

- The page must use React 16+ with fiber architecture
- Try refreshing the page
- Check console for errors

### No issues detected?

- The extension only shows issues when they're found
- Try the test scenarios above
- Check that React is in development mode for some features

---

## Documentation

For a comprehensive debugging guide covering all tabs, metrics, and debugging strategies for developers at every skill level, see:

**[DEBUGGING-GUIDE.md](./DEBUGGING-GUIDE.md)**

The guide includes:

- Detailed explanation of each tab and its metrics
- Debugging workflows for Fresher, Mid-level, and Senior developers
- Common issues and their fixes with code examples
- Best practices for Performance, Memory, State Management, and Layout Stability
- Quick reference tables for thresholds and color coding

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - Copyright (c) 2025 NhoNH
