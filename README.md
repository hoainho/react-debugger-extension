# ⚛️ React Debugger - Chrome Extension

**Author:** NhoNH  
**Version:** 1.0.0  
**License:** MIT

Advanced debugging & performance optimization tool for ReactJS applications.

## ✨ Features

- 🎯 **UI & State Issues** - Detect direct state mutation, missing keys, index as key
- ⚡ **Performance Analysis** - Track re-renders, identify excessive renders
- 🔄 **Side Effects** - Find missing cleanup, dependency issues in useEffect
- 📐 **CLS Monitor** - Track Cumulative Layout Shift in real-time
- 🗄️ **Redux DevTools** - View state tree, dispatch actions manually

---

## 🚀 Installation

### Option 1: Load Unpacked (Development)

1. **Build the extension:**
   ```bash
   cd react-debugger-extension
   npm install
   npm run build
   ```

2. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top right)
   - Click **"Load unpacked"**
   - Select the `dist` folder inside `react-debugger-extension`

3. **Verify installation:**
   - Open DevTools on any page (F12)
   - Look for the **"React Debugger"** tab

### Option 2: Install from ZIP

1. Build and package:
   ```bash
   npm run package
   ```
2. This creates `react-debugger.zip`
3. Unzip and load as unpacked extension

---

## 📖 How to Test

### Step 1: Open a React Application

Test on any React website or local development server:
- https://react.dev (official React docs)
- https://reactjs.org
- Any local React app (Create React App, Next.js, Vite, etc.)

### Step 2: Open DevTools

1. Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
2. Find the **"React Debugger"** tab in the DevTools panel tabs

### Step 3: Explore Features

#### 🎯 UI & State Tab
- Shows issues with state management and list keys
- Click on any issue to expand details
- Follow suggestions to fix problems

#### ⚡ Performance Tab
- Shows component render statistics
- Lists top re-rendering components
- Identifies render triggers (props, state, context)

#### 🔄 Side Effects Tab
- Lists useEffect issues
- Identifies missing cleanup functions
- Shows dependency problems

#### 📐 CLS Tab
- Real-time CLS score monitoring
- Shows top layout shift contributors
- Timeline of shift events

#### 🗄️ Redux Tab
- View Redux state tree (if Redux is detected)
- See action history
- Dispatch custom actions for testing

---

## 🧪 Test Scenarios

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
    const id = setInterval(() => setCount(c => c + 1), 100);
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
      console.log('tick');
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
<img src="large-image.jpg" />  <!-- No width/height -->
```

**Expected:** CLS score > 0 shown in CLS tab when image loads.

---

## 🛠️ Development

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

## 📁 Project Structure

```
react-debugger-extension/
├── src/
│   ├── background/     # Service worker
│   ├── content/        # Content script (CLS monitoring)
│   ├── inject/         # Page script (React fiber hook)
│   ├── devtools/       # DevTools page entry
│   ├── panel/          # React panel UI
│   │   ├── components/ # Reusable components
│   │   ├── tabs/       # Tab content components
│   │   └── styles/     # CSS styles
│   ├── types/          # TypeScript types
│   └── utils/          # Utility functions
├── public/
│   ├── manifest.json   # Extension manifest
│   └── icons/          # Extension icons
├── dist/               # Build output (load this in Chrome)
└── package.json
```

---

## 🔧 Troubleshooting

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

## 📄 License

MIT License - Copyright (c) 2025 NhoNH
