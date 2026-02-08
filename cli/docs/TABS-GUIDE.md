# React Debugger - Complete Tabs Guide

Deep dive into each tab's features, metrics, and how to use them effectively.

---

## Table of Contents

1. [Timeline Tab](#1-timeline-tab)
2. [UI & State Tab](#2-ui--state-tab)
3. [Performance Tab](#3-performance-tab)
4. [Memory Tab](#4-memory-tab)
5. [Side Effects Tab](#5-side-effects-tab)
6. [CLS Tab](#6-cls-tab)
7. [Redux Tab](#7-redux-tab)

---

## 1. Timeline Tab

The Timeline provides a chronological view of everything happening in your React app.

### Event Types

| Icon | Type | Description |
|------|------|-------------|
| 🔄 | **Render** | Component render/re-render |
| 📦 | **State** | State change (local or Redux) |
| ⚡ | **Effect** | useEffect execution |
| ❌ | **Error** | JavaScript error |
| 🧠 | **Memory** | Memory snapshot |
| 🔗 | **Context** | Context value change |

### Render Events

Each render event shows:

```
┌─────────────────────────────────────────────────┐
│ 🔄 MyComponent                         12:34:56 │
│ ─────────────────────────────────────────────── │
│ Duration: 2.3ms                                 │
│ Trigger: props (items, onClick)                 │
│ Fiber Depth: 5                                  │
│ Render Order: #3 in batch                       │
└─────────────────────────────────────────────────┘
```

| Field | Meaning |
|-------|---------|
| Duration | How long the render took |
| Trigger | What caused the render |
| Fiber Depth | Component depth in tree |
| Render Order | Position in render batch |

### State Change Events

```
┌─────────────────────────────────────────────────┐
│ 📦 State Change                        12:34:57 │
│ ─────────────────────────────────────────────── │
│ Component: Counter                              │
│ Hook: useState (#0)                             │
│ State Name: count                               │
│ Old Value: 5                                    │
│ New Value: 6                                    │
└─────────────────────────────────────────────────┘
```

### Using Filters

Click filter buttons to show/hide event types:

```
[🔄 Renders ✓] [📦 State ✓] [⚡ Effects] [❌ Errors ✓]
```

### Search

Type in the search box to filter by:
- Component name
- Event type
- Action type (for Redux)

### Event Correlation

Click any event to highlight related events:
- Renders that followed a state change
- Effects triggered by renders
- Errors with their causes

---

## 2. UI & State Tab

Automatically detects React anti-patterns and common mistakes.

### Issue Types

#### 🔴 DIRECT_STATE_MUTATION (Error)

**Problem:** Modifying state object directly instead of creating new reference.

```jsx
// ❌ Bad - React won't detect the change
const [user, setUser] = useState({ name: 'John' });
user.name = 'Jane';  // Direct mutation!
setUser(user);

// ✅ Good - Create new object
setUser({ ...user, name: 'Jane' });
```

**Why it matters:** React uses reference equality to detect changes. Mutating the same object doesn't trigger re-renders.

---

#### 🟡 MISSING_KEY (Warning)

**Problem:** List items rendered without `key` prop.

```jsx
// ❌ Bad
{items.map(item => <li>{item}</li>)}

// ✅ Good
{items.map(item => <li key={item.id}>{item}</li>)}
```

**Why it matters:** Without keys, React can't track which items changed, leading to bugs and poor performance.

---

#### 🟡 INDEX_AS_KEY (Warning)

**Problem:** Using array index as key for dynamic lists.

```jsx
// ❌ Bad - problematic when list order changes
{items.map((item, index) => <li key={index}>{item}</li>)}

// ✅ Good - use stable unique ID
{items.map(item => <li key={item.id}>{item}</li>)}
```

**When index IS okay:**
- Static lists that never change
- No reordering, adding, or removing items
- Items have no state

---

#### 🔴 DUPLICATE_KEY (Error)

**Problem:** Multiple items have the same key.

```jsx
// ❌ Bad - two items with key="1"
<li key="1">Apple</li>
<li key="1">Banana</li>  // Duplicate!

// ✅ Good - unique keys
<li key="apple">Apple</li>
<li key="banana">Banana</li>
```

---

### Issue Card Anatomy

```
┌─────────────────────────────────────────────────┐
│ 🔴 DIRECT_STATE_MUTATION                        │
│ ─────────────────────────────────────────────── │
│ Component: UserProfile                          │
│ Path: App > Dashboard > UserProfile             │
│                                                 │
│ Message: State object was mutated directly      │
│                                                 │
│ 💡 Suggestion: Create a new object/array        │
│    instead of modifying the existing one.       │
│                                                 │
│ [View Code] [Dismiss]                           │
└─────────────────────────────────────────────────┘
```

---

## 3. Performance Tab

Comprehensive performance analysis with Core Web Vitals and render statistics.

### Statistics Dashboard

```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Components  │ Total Renders│ Avg Render   │ Slow Renders │
│      24      │     156      │    4.2ms     │      3       │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

| Metric | Description | Target |
|--------|-------------|--------|
| Components | Tracked components | - |
| Total Renders | Sum of all renders | Lower = better |
| Avg Render | Average render time | < 16ms |
| Slow Renders | Renders > 16ms | 0 |

### Core Web Vitals

```
┌────────────────────────────────────────────────────────┐
│ Page Load Metrics                                      │
│ ────────────────────────────────────────────────────── │
│ FCP: 1.2s  ✅    LCP: 2.1s  ✅    TTFB: 0.3s  ✅      │
└────────────────────────────────────────────────────────┘
```

| Metric | Full Name | Good | Needs Work | Poor |
|--------|-----------|------|------------|------|
| FCP | First Contentful Paint | < 1.8s | 1.8-3s | > 3s |
| LCP | Largest Contentful Paint | < 2.5s | 2.5-4s | > 4s |
| TTFB | Time to First Byte | < 0.8s | 0.8-1.8s | > 1.8s |

### Slowest Components Table

```
┌─────────────────┬──────────┬──────────┬─────────┐
│ Component       │ Max Time │ Avg Time │ Renders │
├─────────────────┼──────────┼──────────┼─────────┤
│ DataGrid        │ 45.2ms   │ 23.1ms   │ 12      │
│ Chart           │ 32.1ms   │ 18.5ms   │ 8       │
│ UserList        │ 28.7ms   │ 15.2ms   │ 24      │
└─────────────────┴──────────┴──────────┴─────────┘
```

**Action:** Focus on components with Max Time > 16ms.

### Top Re-rendering Components

```
┌─────────────────┬─────────┬──────────┬───────────┬─────────────┐
│ Component       │ Renders │ Avg Time │ Self Time │ Last Trigger│
├─────────────────┼─────────┼──────────┼───────────┼─────────────┤
│ SearchInput     │ 47      │ 1.2ms    │ 0.8ms     │ state       │
│ FilterButton    │ 32      │ 0.5ms    │ 0.3ms     │ parent      │
│ ListItem        │ 28      │ 0.3ms    │ 0.2ms     │ props       │
└─────────────────┴─────────┴──────────┴───────────┴─────────────┘
```

| Column | Meaning |
|--------|---------|
| Renders | Total render count |
| Avg Time | Average total render time |
| Self Time | Time in component (excluding children) |
| Last Trigger | Most recent render cause |

### React Scan (Visual Mode)

Toggle ON to see renders directly on the page:

| Color | Render Count | Meaning |
|-------|--------------|---------|
| 🟢 Green | 1 | Initial mount |
| 🟡 Yellow | 2-3 | Some re-renders |
| 🟠 Orange | 4-5 | Frequent re-renders |
| 🔴 Red | 10+ | Excessive - optimize! |

### Optimization Strategies

**For `props` trigger:**
```jsx
// Wrap with React.memo
export const MyComponent = React.memo(({ data }) => {
  return <div>{data.name}</div>;
});
```

**For `parent` trigger:**
```jsx
// Memoize to prevent re-render when parent updates
export const Child = React.memo(({ value }) => {
  return <span>{value}</span>;
});
```

**For `state` trigger:**
```jsx
// Batch state updates
const handleClick = () => {
  // React 18+ auto-batches, but be mindful
  setCount(c => c + 1);
  setFlag(f => !f);
};
```

**For `context` trigger:**
```jsx
// Split contexts by update frequency
const ThemeContext = createContext();  // Rarely changes
const UserContext = createContext();   // Changes on login
```

---

## 4. Memory Tab

Monitor JavaScript heap usage and detect memory leaks.

### Dashboard

```
┌────────────────────────────────────────────────────────┐
│ Memory Usage                                           │
│ ════════════════════════════════════════════════════   │
│ ████████████████████░░░░░░░░░░░░  65%                 │
│                                                        │
│ Used: 45.2 MB    Total: 69.5 MB    Limit: 4.0 GB      │
│ Peak: 52.1 MB    Growth: +12 KB/s                      │
└────────────────────────────────────────────────────────┘
```

### Key Metrics

| Metric | Description |
|--------|-------------|
| Used Heap | Currently allocated memory |
| Total Heap | Memory available to JS engine |
| Heap Limit | Maximum allowed |
| Peak Usage | Highest recorded usage |
| Growth Rate | Memory change per second |

### Health Indicators

| Usage | Status | Action |
|-------|--------|--------|
| < 70% | ✅ Healthy | No action |
| 70-90% | ⚠️ Warning | Monitor |
| > 90% | 🔴 Critical | Investigate |

### Growth Rate Analysis

| Rate | Status | Meaning |
|------|--------|---------|
| Negative | ✅ Good | GC is working |
| 0 - 512 KB/s | ✅ Normal | Typical fluctuation |
| 512 KB - 1 MB/s | ⚠️ Warning | Possible leak |
| > 1 MB/s | 🔴 Critical | Likely memory leak |

### Memory Chart

The chart shows memory usage over time:
- **Blue line:** Used heap
- **Gray line:** Total heap
- **Spikes:** Indicate allocations
- **Drops:** Indicate garbage collection

### Crash Log

Captures errors with memory context:

```
┌─────────────────────────────────────────────────────┐
│ ❌ TypeError                           12:34:56     │
│ ─────────────────────────────────────────────────── │
│ Cannot read property 'map' of undefined             │
│                                                     │
│ Component Stack:                                    │
│   at UserList (UserList.jsx:15)                     │
│   at Dashboard (Dashboard.jsx:42)                   │
│                                                     │
│ Memory at crash: 67.2 MB (78%)                      │
└─────────────────────────────────────────────────────┘
```

### Finding Memory Leaks

1. **Start Monitoring** - Click the button
2. **Create a baseline** - Note initial memory
3. **Perform actions** - Navigate, open/close modals
4. **Return to start** - Go back to initial state
5. **Compare** - Memory should return to baseline

**Common leak sources:**
- Event listeners not removed
- Timers not cleared
- Subscriptions not unsubscribed
- Closures holding references

---

## 5. Side Effects Tab

Analyze useEffect hooks for common issues.

### Issue Categories

#### MISSING_CLEANUP

```jsx
// ❌ Bad - timer keeps running after unmount
useEffect(() => {
  const id = setInterval(() => {
    console.log('tick');
  }, 1000);
  // Missing cleanup!
}, []);

// ✅ Good
useEffect(() => {
  const id = setInterval(() => {
    console.log('tick');
  }, 1000);
  return () => clearInterval(id);  // Cleanup
}, []);
```

#### MISSING_DEP

```jsx
// ❌ Bad - count not in dependencies
useEffect(() => {
  document.title = `Count: ${count}`;
}, []);  // Should be [count]

// ✅ Good
useEffect(() => {
  document.title = `Count: ${count}`;
}, [count]);
```

#### INFINITE_LOOP_RISK

```jsx
// ❌ Bad - updates state that triggers effect again
useEffect(() => {
  setCount(count + 1);  // Infinite loop!
}, [count]);

// ✅ Good - use functional update
useEffect(() => {
  setCount(c => c + 1);
}, []);  // Run once
```

#### STALE_CLOSURE

```jsx
// ❌ Bad - callback captures stale count value
useEffect(() => {
  const handler = () => {
    console.log(count);  // Always logs initial value
  };
  window.addEventListener('click', handler);
  return () => window.removeEventListener('click', handler);
}, []);  // Missing count

// ✅ Good - use ref for latest value
const countRef = useRef(count);
countRef.current = count;

useEffect(() => {
  const handler = () => {
    console.log(countRef.current);  // Always current
  };
  window.addEventListener('click', handler);
  return () => window.removeEventListener('click', handler);
}, []);
```

### Effect Card Details

```
┌─────────────────────────────────────────────────────┐
│ ⚠️ MISSING_CLEANUP                                  │
│ ─────────────────────────────────────────────────── │
│ Component: DataFetcher                              │
│ Effect Index: #0                                    │
│                                                     │
│ Dependencies: [userId]                              │
│ Has Cleanup: No ❌                                  │
│                                                     │
│ Effect Preview:                                     │
│   fetch(`/api/user/${userId}`)                      │
│     .then(res => setUser(res))                      │
│                                                     │
│ 💡 Tip: Use AbortController for fetch cleanup       │
└─────────────────────────────────────────────────────┘
```

---

## 6. CLS Tab

Monitor Cumulative Layout Shift - a Core Web Vital for visual stability.

### Score Interpretation

| Score | Rating | User Experience |
|-------|--------|-----------------|
| < 0.1 | ✅ Good | Stable, smooth |
| 0.1 - 0.25 | ⚠️ Needs Improvement | Noticeable shifts |
| > 0.25 | 🔴 Poor | Frustrating experience |

### Dashboard

```
┌────────────────────────────────────────────────────────┐
│ CLS Score: 0.15                                        │
│ ████████████████░░░░░░░░░░░░░░  ⚠️ Needs Improvement  │
│                                                        │
│ Total Shifts: 5    Last Shift: 2.3s ago               │
└────────────────────────────────────────────────────────┘
```

### Top Shift Sources

```
┌─────────────────────────────────┬────────────┬────────────┐
│ Element                         │ Total Shift│ Occurrences│
├─────────────────────────────────┼────────────┼────────────┤
│ img.hero-image                  │ 0.08       │ 1          │
│ div.ad-container                │ 0.05       │ 3          │
│ p.dynamic-content               │ 0.02       │ 2          │
└─────────────────────────────────┴────────────┴────────────┘
```

### Common Causes & Fixes

| Cause | Fix |
|-------|-----|
| Images without dimensions | Add `width` and `height` attributes |
| Ads/embeds | Set explicit container dimensions |
| Dynamic content | Reserve space with `min-height` |
| Web fonts | Use `font-display: swap` |
| Animations | Use `transform` instead of `top/left` |

**Image fix:**
```jsx
// ❌ Bad
<img src="photo.jpg" alt="Photo" />

// ✅ Good
<img src="photo.jpg" alt="Photo" width={800} height={600} />

// ✅ Also good - aspect ratio
<img 
  src="photo.jpg" 
  alt="Photo"
  style={{ aspectRatio: '16/9', width: '100%' }}
/>
```

**Dynamic content fix:**
```jsx
// ❌ Bad - content pushes things down
{loaded && <Content />}

// ✅ Good - space reserved
<div style={{ minHeight: 200 }}>
  {loaded ? <Content /> : <Skeleton />}
</div>
```

---

## 7. Redux Tab

**The most powerful Redux debugging experience** - view state, edit values live, dispatch actions, and manipulate arrays directly.

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ 🗄️ Redux DevTools                                    [🔄]      │
├────────────────────────┬────────────────────────────────────────┤
│   Action History (12)  │  State Tree           [🔍] [+] [−] [⟲]│
│ ───────────────────────│────────────────────────────────────────│
│ 12:34:56 user/login    │  ▼ user                                │
│ 12:34:58 posts/fetch   │    ├─ id: 123          ← click to edit │
│ 12:35:01 ui/toggle     │    ├─ name: "John"     ← click to edit │
│ 12:35:03 cart/add  ◀── │    └─ role: "admin"                    │
│                        │  ▼ cart                                │
│   [Action Details]     │    └─ items: Array(3)  [↑] [↓] [×]     │
└────────────────────────┴────────────────────────────────────────┘
│                    Dispatch Action                              │
│  Type: [cart/addItem          ]  Payload: [{ "id": 4 }]  [Send] │
└─────────────────────────────────────────────────────────────────┘
```

---

### 🌳 State Tree Browser

Interactive tree view of your entire Redux state.

```
┌─────────────────────────────────────────────────────┐
│ 🔍 Search state...              [+] [−] [⟲]        │
├─────────────────────────────────────────────────────┤
│ ▼ user                                              │
│   ├─ id: 123                    ← Number (editable)│
│   ├─ name: "John Doe"           ← String (editable)│
│   ├─ isAdmin: true              ← Boolean (toggle) │
│   └─ email: "john@example.com"                      │
│ ▼ cart                                              │
│   ├─ total: 99.99                                   │
│   └▼ items: Array(2)                                │
│      ├─ [0]: { id: 1, name: "Book" }    [↑][↓][×] │
│      └─ [1]: { id: 2, name: "Pen" }     [↑][↓][×] │
│ ▶ settings (collapsed - click to expand)            │
└─────────────────────────────────────────────────────┘
```

#### Controls

| Button | Action |
|--------|--------|
| `+` | Expand all nodes |
| `−` | Collapse all nodes |
| `⟲` | Reset all edited values |
| `🔄` | Refresh state from store |

#### Search

Type in the search box to filter state keys:
- Searches both key names and values
- Great for finding specific data in large state trees

---

### ✏️ Live State Editing (Key Feature!)

**Click any value to edit it directly** - changes apply immediately via Redux.

#### Supported Types

| Type | How to Edit |
|------|-------------|
| **String** | Click → Type new value → Enter |
| **Number** | Click → Type number → Enter |
| **Boolean** | Click → Dropdown (true/false) |
| **Object/Array** | Click → JSON editor → Enter |
| **null** | Click → Edit as any type |

#### Editing Workflow

```
1. Click on a value:
   name: "John"  →  name: [John          ] [✓] [✗]
                           ↑ editable input

2. Modify the value:
   name: [Jane          ] [✓] [✗]

3. Press Enter or click ✓ to save
   Changes apply immediately to Redux store!

4. Press Escape or click ✗ to cancel
```

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Save changes |
| `Escape` | Cancel editing |

#### Example Use Cases

```jsx
// Testing different user roles
user.role: "admin" → "moderator" → "user"

// Adjusting cart totals
cart.total: 99.99 → 0 → 150.00

// Toggling feature flags
features.darkMode: false → true

// Modifying complex objects
user.preferences: { theme: "light" } → { theme: "dark", fontSize: 16 }
```

---

### 📦 Array Manipulation

**Powerful array controls** for each item in arrays:

```
▼ cart.items: Array(3)
   ├─ [0]: { id: 1, name: "Book" }     [↑] [↓] [×]
   ├─ [1]: { id: 2, name: "Pen" }      [↑] [↓] [×]
   └─ [2]: { id: 3, name: "Paper" }    [↑] [↓] [×]
```

| Button | Action | Use Case |
|--------|--------|----------|
| `↑` | Move item up | Reorder list items |
| `↓` | Move item down | Reorder list items |
| `×` | Delete item | Remove from array |

#### Example: Reordering Cart Items

```
Before:                          After clicking ↑ on [1]:
├─ [0]: Book                     ├─ [0]: Pen      ← moved up
├─ [1]: Pen                      ├─ [1]: Book     ← moved down
└─ [2]: Paper                    └─ [2]: Paper
```

---

### 📜 Action History

See every Redux action dispatched in your app:

```
┌─────────────────────────────────────────────────────┐
│ Action History (47)                                 │
├─────────────────────────────────────────────────────┤
│ 12:34:56  user/login                               │
│ 12:34:58  posts/fetchPending                       │
│ 12:35:01  posts/fetchSuccess                       │
│ 12:35:03  cart/addItem         ← Click to select   │
│ 12:35:05  ui/openModal                             │
└─────────────────────────────────────────────────────┘
```

#### Click an Action to See Details

```
┌─────────────────────────────────────────────────────┐
│ Action: cart/addItem                                │
├─────────────────────────────────────────────────────┤
│ Payload:                                            │
│ {                                                   │
│   "productId": 123,                                │
│   "quantity": 2,                                   │
│   "price": 29.99                                   │
│ }                                                   │
└─────────────────────────────────────────────────────┘
```

**Use cases:**
- Debug why state changed unexpectedly
- Verify actions are dispatched correctly
- Check action payloads for errors

---

### 🚀 Action Dispatcher

**Test your reducers** by dispatching custom actions:

```
┌─────────────────────────────────────────────────────┐
│ Dispatch Action                                     │
├─────────────────────────────────────────────────────┤
│ Type:                                               │
│ [cart/addItem                                    ]  │
│                                                     │
│ Payload (JSON):                                     │
│ [                                                ]  │
│ [{                                               ]  │
│ [  "productId": 999,                             ]  │
│ [  "quantity": 1                                 ]  │
│ [}                                               ]  │
│                                                     │
│                              [Dispatch Action]      │
└─────────────────────────────────────────────────────┘
```

#### Common Testing Scenarios

**Test edge cases:**
```json
// Empty cart
Type: cart/clear
Payload: {}

// Add item with invalid data
Type: cart/addItem
Payload: { "productId": null, "quantity": -1 }

// Simulate API error
Type: api/error
Payload: { "code": 500, "message": "Server error" }
```

**Test user flows:**
```json
// Login as different user
Type: auth/loginSuccess
Payload: { "userId": 456, "role": "admin" }

// Toggle feature flag
Type: features/toggle
Payload: { "feature": "darkMode", "enabled": true }
```

---

### 🔍 Redux Detection Methods

The extension automatically finds your Redux store via:

| Method | Priority | Description |
|--------|----------|-------------|
| `window.store` | 1st | Explicitly exposed store |
| `window.__REDUX_STORE__` | 2nd | Alternative naming |
| Redux DevTools Extension | 3rd | Uses existing connection |
| React-Redux Provider | 4th | Finds store in React fiber tree |

#### Recommended Setup

```jsx
// store.js
import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './reducers';

const store = configureStore({
  reducer: rootReducer,
  devTools: process.env.NODE_ENV !== 'production',
});

// Expose for React Debugger (development only)
if (process.env.NODE_ENV === 'development') {
  window.store = store;
}

export default store;
```

#### Redux Toolkit (Recommended)

```jsx
// RTK automatically connects to DevTools
import { configureStore } from '@reduxjs/toolkit';

const store = configureStore({
  reducer: {
    user: userReducer,
    cart: cartReducer,
  },
});

// That's it! DevTools connection is automatic
```

#### Legacy Redux

```jsx
import { createStore, applyMiddleware, compose } from 'redux';

const composeEnhancers = 
  window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const store = createStore(
  rootReducer,
  composeEnhancers(applyMiddleware(...middleware))
);

window.store = store; // For React Debugger
```

---

### 💡 Pro Tips

#### 1. Quick State Reset

Made too many edits? Click `⟲` to reset all values to original.

#### 2. Test Loading States

```json
Type: posts/fetchPending
Payload: {}
// Then check your loading UI

Type: posts/fetchSuccess  
Payload: { "posts": [...] }
// Check success state
```

#### 3. Simulate Errors

```json
Type: posts/fetchError
Payload: { "error": "Network timeout" }
// Check error handling UI
```

#### 4. Debug Selectors

Edit state values to see if selectors update correctly:
```
user.subscription: "free" → "premium"
// Watch if premium features appear
```

#### 5. Test Permissions

```
user.role: "user" → "admin"
// Verify admin-only features show/hide
```

---

### ⚠️ Troubleshooting

#### "Redux not detected"

Check the Setup Guide shown in the tab:

1. Verify Redux is actually used in the app
2. Expose store via `window.store`
3. Install Redux DevTools browser extension
4. Refresh the page

#### State doesn't update after edit

1. Click `🔄` Refresh button
2. Check browser console for errors
3. Verify reducer handles the action

#### Actions not appearing

1. Make sure Recording is enabled (green badge)
2. Actions must be dispatched after opening DevTools
3. Check if middleware is blocking actions

---

## Quick Reference

### When to Use Each Tab

| Scenario | Tab |
|----------|-----|
| "What just happened?" | Timeline |
| "Is my code correct?" | UI & State |
| "Why is it slow?" | Performance |
| "Is there a leak?" | Memory |
| "Are my effects right?" | Side Effects |
| "Why does it jump?" | CLS |
| "What's in my store?" | Redux |

### Metric Thresholds

| Metric | Good | Warning | Poor |
|--------|------|---------|------|
| Render time | < 16ms | 16-50ms | > 50ms |
| Memory usage | < 70% | 70-90% | > 90% |
| CLS score | < 0.1 | 0.1-0.25 | > 0.25 |
| FCP | < 1.8s | 1.8-3s | > 3s |
| LCP | < 2.5s | 2.5-4s | > 4s |
