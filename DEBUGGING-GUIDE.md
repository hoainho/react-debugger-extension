# React Debugger - Comprehensive Debugging Guide

A complete guide to debugging React applications using the React Debugger Chrome Extension. This guide covers all tabs, metrics, and debugging strategies for developers at every skill level.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding the Tabs](#understanding-the-tabs)
   - [Timeline Tab](#1-timeline-tab)
   - [UI & State Tab](#2-ui--state-tab)
   - [Performance Tab](#3-performance-tab)
   - [Memory Tab](#4-memory-tab)
   - [Side Effects Tab](#5-side-effects-tab)
   - [CLS Tab](#6-cls-tab)
   - [Redux Tab](#7-redux-tab)
3. [Debugging by Experience Level](#debugging-by-experience-level)
4. [Common Issues and Fixes](#common-issues-and-fixes)
5. [Best Practices](#best-practices)

---

## Getting Started

### Installation

1. Build the extension:
   ```bash
   npm install
   npm run build
   ```

2. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

3. Open DevTools (F12) and find the "React Debugger" tab

### When to Use This Extension

- Debugging slow or janky UI
- Finding memory leaks
- Tracking down unnecessary re-renders
- Identifying missing useEffect cleanups
- Monitoring layout shifts (CLS)
- Debugging Redux state

---

## Understanding the Tabs

### 1. Timeline Tab

The Timeline tab provides a chronological view of all events happening in your React application.

#### Event Types

| Icon | Type | Description |
|------|------|-------------|
| :repeat: | Render | Component render events |
| :package: | State | State changes (local or Redux) |
| :zap: | Effect | useEffect runs and cleanups |
| :x: | Error | JavaScript errors and crashes |
| :brain: | Memory | Memory snapshots and spikes |

#### Key Metrics

- **Render Order**: Shows the sequence in which components rendered within a batch
- **Trigger**: What caused the render (props, state, context, parent, mount)
- **Duration**: How long the render took in milliseconds
- **Batch ID**: Groups related renders that happened together

#### How to Use

1. **Filter Events**: Click the filter buttons to show/hide event types
2. **Search**: Use the search box to find specific components or actions
3. **Correlate**: Click an event to see related events highlighted
4. **Snapshots**: Capture render snapshots for later comparison

#### What to Look For

| Observation | Potential Issue |
|-------------|-----------------|
| Same component rendering many times | Unnecessary re-renders |
| Long render durations (>16ms) | Slow component - needs optimization |
| Rapid state changes | Possible infinite loop |
| Effects running without cleanup | Memory leak risk |

---

### 2. UI & State Tab

Detects common React anti-patterns related to UI rendering and state management.

#### Issue Types

| Issue | Severity | Description |
|-------|----------|-------------|
| DIRECT_STATE_MUTATION | Error | Modifying state directly instead of using setState |
| MISSING_KEY | Warning | List items without key prop |
| INDEX_AS_KEY | Warning | Using array index as key (problematic for dynamic lists) |
| DUPLICATE_KEY | Error | Multiple items with the same key |

#### Understanding Each Issue

##### Direct State Mutation
```jsx
// BAD - Direct mutation
const [items, setItems] = useState([1, 2, 3]);
items.push(4); // Mutating state directly!
setItems(items);

// GOOD - Create new array
setItems([...items, 4]);
```

##### Missing Key
```jsx
// BAD - No keys
{items.map(item => <li>{item}</li>)}

// GOOD - Unique keys
{items.map(item => <li key={item.id}>{item.name}</li>)}
```

##### Index as Key
```jsx
// BAD - Index as key (problematic when list changes)
{items.map((item, index) => <li key={index}>{item}</li>)}

// GOOD - Stable unique ID
{items.map(item => <li key={item.id}>{item}</li>)}
```

---

### 3. Performance Tab

Comprehensive performance analysis including render statistics and Core Web Vitals.

#### Statistics Dashboard

| Metric | Description | Good Value |
|--------|-------------|------------|
| Components | Total tracked components | N/A |
| Total Renders | Sum of all component renders | Lower is better |
| Avg Render Time | Average render duration | < 16ms |
| Slow Renders | Renders exceeding 16ms | 0 |

#### Page Load Metrics (Core Web Vitals)

| Metric | Full Name | Good | Needs Improvement | Poor |
|--------|-----------|------|-------------------|------|
| FCP | First Contentful Paint | < 1.8s | 1.8s - 3s | > 3s |
| LCP | Largest Contentful Paint | < 2.5s | 2.5s - 4s | > 4s |
| TTFB | Time to First Byte | < 0.8s | 0.8s - 1.8s | > 1.8s |

#### React Scan Feature

Enable "React Scan" to visualize re-renders directly on the page:

| Color | Render Count |
|-------|--------------|
| Green | 1 render |
| Yellow | 2-3 renders |
| Orange | 4-5 renders |
| Red-Orange | 6-10 renders |
| Red | 10+ renders |

#### Tables Explained

**Slowest Components Table**
- **Component**: Name of the React component
- **Max Time**: Longest render duration recorded
- **Avg Time**: Average render time across all renders
- **Renders**: Total number of times rendered

**Top Re-rendering Components Table**
- **Component**: Name of the React component
- **Renders**: Total render count
- **Avg Time**: Average total render time
- **Self Time**: Time spent in the component itself (excluding children)
- **Last Trigger**: What caused the most recent render

#### Trigger Types

| Trigger | Meaning | Common Fix |
|---------|---------|------------|
| props | Props changed | Use React.memo, optimize parent |
| state | Local state changed | Reduce state updates |
| context | Context value changed | Split contexts, memoize values |
| parent | Parent re-rendered | Use React.memo |
| mount | Initial mount | Normal, no fix needed |

---

### 4. Memory Tab

Monitor JavaScript heap usage and detect memory leaks.

#### Key Metrics

| Metric | Description |
|--------|-------------|
| Used Heap | Currently allocated memory |
| Total Heap | Total memory available to JS |
| Heap Limit | Maximum memory limit |
| Peak Usage | Highest memory usage recorded |
| Growth Rate | Memory change per second |

#### Memory Health Indicators

| Usage % | Status | Action |
|---------|--------|--------|
| < 70% | Healthy | No action needed |
| 70-90% | Warning | Monitor closely |
| > 90% | Critical | Investigate immediately |

#### Growth Rate Interpretation

| Rate | Status | Meaning |
|------|--------|---------|
| Negative | Good | Memory being freed (GC) |
| 0 - 512KB/s | Normal | Typical fluctuation |
| 512KB - 1MB/s | Warning | Possible leak |
| > 1MB/s | Critical | Likely memory leak |

#### Crash Log

The Memory tab also captures:
- JavaScript errors
- Unhandled promise rejections
- React error boundary catches

Each crash includes:
- Timestamp
- Error message
- Stack trace
- Memory state at crash time
- Analysis hints

---

### 5. Side Effects Tab

Analyze useEffect hooks for common issues.

#### Issue Categories

##### Missing Cleanup
Effects that set up subscriptions, timers, or listeners but don't clean up.

```jsx
// BAD - No cleanup
useEffect(() => {
  const id = setInterval(() => console.log('tick'), 1000);
  // Missing: return () => clearInterval(id);
}, []);

// GOOD - With cleanup
useEffect(() => {
  const id = setInterval(() => console.log('tick'), 1000);
  return () => clearInterval(id);
}, []);
```

##### Dependency Issues

**Missing Dependency**
```jsx
// BAD - count not in deps
useEffect(() => {
  console.log(count);
}, []); // Should include [count]
```

**Extra Dependency**
```jsx
// BAD - unnecessary dependency
useEffect(() => {
  fetchData();
}, [somethingUnrelated]); // Causes unnecessary re-runs
```

##### Infinite Loop Risk
```jsx
// BAD - Setting state that triggers re-render that re-runs effect
useEffect(() => {
  setCount(count + 1); // Infinite loop!
}, [count]);
```

##### Stale Closures
```jsx
// BAD - Callback captures stale value
useEffect(() => {
  const handleClick = () => {
    console.log(count); // Always logs initial value
  };
  window.addEventListener('click', handleClick);
  return () => window.removeEventListener('click', handleClick);
}, []); // Missing count dependency
```

---

### 6. CLS Tab

Monitor Cumulative Layout Shift - a Core Web Vital measuring visual stability.

#### CLS Score Interpretation

| Score | Rating | User Experience |
|-------|--------|-----------------|
| < 0.1 | Good | Stable, no jarring shifts |
| 0.1 - 0.25 | Needs Improvement | Noticeable shifts |
| > 0.25 | Poor | Significant layout instability |

#### Top Shift Sources Table

| Column | Description |
|--------|-------------|
| Element | CSS selector of shifting element |
| Total Shift | Cumulative shift score from this element |
| Occurrences | How many times this element shifted |

#### Common CLS Causes and Fixes

| Cause | Fix |
|-------|-----|
| Images without dimensions | Add width and height attributes |
| Dynamic content insertion | Reserve space with min-height |
| Font loading | Use font-display: swap |
| Ads/embeds | Set explicit dimensions |
| Animations | Use transform instead of top/left |

---

### 7. Redux Tab

Debug Redux state and dispatch actions.

#### Features

1. **State Tree Browser**
   - Expandable/collapsible tree view
   - Search functionality
   - Direct value editing
   - Array item manipulation (move, delete)

2. **Action History**
   - Chronological list of dispatched actions
   - Click to view action details and payload

3. **Action Dispatcher**
   - Send custom actions for testing
   - JSON payload support

#### Setup Requirements

The extension detects Redux via:
- `window.store`
- `window.__REDUX_STORE__`
- Redux DevTools Extension
- React-Redux Provider context

```jsx
// Expose store for debugging
if (process.env.NODE_ENV === 'development') {
  window.store = store;
}
```

---

## Debugging by Experience Level

### Fresher / Junior Developer

**Focus Areas:**
1. UI & State Tab - Learn proper React patterns
2. Side Effects Tab - Understand useEffect

**Workflow:**
1. Open the extension after your app loads
2. Check UI & State tab for red/yellow issues
3. Read the suggestions and fix one at a time
4. Check Side Effects tab for missing cleanups

**Key Things to Remember:**
- Always use unique keys in lists (not array index)
- Never mutate state directly
- Always clean up timers and event listeners

### Mid-Level Developer

**Focus Areas:**
1. Performance Tab - Optimize render performance
2. Timeline Tab - Understand render cascades
3. Memory Tab - Prevent memory leaks

**Workflow:**
1. Enable React Scan to visualize re-renders
2. Identify components rendering excessively
3. Use Timeline to trace render triggers
4. Apply React.memo, useMemo, useCallback

**Optimization Checklist:**
- [ ] Components with >10 renders - investigate
- [ ] Render times >16ms - optimize or split
- [ ] Parent renders causing child renders - add memoization
- [ ] Context changes causing wide re-renders - split contexts

### Senior Developer

**Focus Areas:**
1. All tabs - holistic view
2. Timeline correlations - find root causes
3. Memory patterns - detect slow leaks
4. CLS optimization - improve UX metrics

**Advanced Workflow:**
1. Take Timeline snapshots at key user interactions
2. Compare render patterns before/after changes
3. Monitor memory over extended sessions
4. Correlate Redux actions with render cascades

**Architecture Considerations:**
- Component boundaries for render isolation
- State colocation vs lifting
- Context granularity
- Lazy loading strategies

---

## Common Issues and Fixes

### Issue: Component renders too often

**Symptoms:**
- High render count in Performance tab
- Excessive re-renders visible with React Scan
- Slow/janky UI

**Debugging Steps:**
1. Find component in "Top Re-rendering Components"
2. Check "Last Trigger" column
3. If trigger is "parent" - parent needs optimization
4. If trigger is "props" - props are changing unnecessarily
5. If trigger is "context" - context is too broad

**Fixes:**
```jsx
// Memoize component
export const MyComponent = React.memo(({ data }) => {
  return <div>{data.name}</div>;
});

// Memoize expensive calculations
const processed = useMemo(() => expensiveCalculation(data), [data]);

// Stable callback references
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

### Issue: Memory keeps growing

**Symptoms:**
- Memory growth rate consistently positive
- "Possible memory leak" warning
- App becomes slow over time

**Debugging Steps:**
1. Start memory monitoring
2. Perform repetitive actions (navigate, open/close modals)
3. Check if memory returns to baseline
4. Look for missing cleanups in Side Effects tab

**Common Fixes:**
```jsx
// Clean up subscriptions
useEffect(() => {
  const subscription = api.subscribe(callback);
  return () => subscription.unsubscribe();
}, []);

// Clean up timers
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);

// Clean up event listeners
useEffect(() => {
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

### Issue: Layout shifts on load

**Symptoms:**
- CLS score > 0.1
- Elements jumping around on page load
- Poor user experience

**Debugging Steps:**
1. Check CLS tab for top contributors
2. Note which elements are shifting
3. Inspect those elements for missing dimensions

**Fixes:**
```jsx
// Images - always set dimensions
<img src="photo.jpg" width={300} height={200} alt="Photo" />

// Or use aspect-ratio
<img src="photo.jpg" style={{ aspectRatio: '16/9', width: '100%' }} />

// Dynamic content - reserve space
<div style={{ minHeight: 200 }}>
  {loading ? <Skeleton /> : <Content />}
</div>
```

### Issue: Stale closure in callback

**Symptoms:**
- Callback uses outdated state values
- setTimeout/setInterval logs old values
- Event handlers have wrong data

**Debugging Steps:**
1. Check Side Effects tab for "Stale Closures"
2. Review the captured vs current values
3. Add missing dependencies or use refs

**Fixes:**
```jsx
// Option 1: Add dependency
useEffect(() => {
  const handler = () => console.log(count);
  window.addEventListener('click', handler);
  return () => window.removeEventListener('click', handler);
}, [count]); // Re-subscribe when count changes

// Option 2: Use ref for latest value
const countRef = useRef(count);
countRef.current = count;

useEffect(() => {
  const handler = () => console.log(countRef.current);
  window.addEventListener('click', handler);
  return () => window.removeEventListener('click', handler);
}, []); // No need to re-subscribe
```

---

## Best Practices

### Performance

1. **Measure before optimizing** - Use the Performance tab to identify actual bottlenecks
2. **Start with the slowest components** - Fix the biggest issues first
3. **Memoize strategically** - Not everything needs React.memo
4. **Split large components** - Smaller components = better caching
5. **Virtualize long lists** - Use react-window or react-virtual

### Memory

1. **Always clean up effects** - Return cleanup functions
2. **Monitor over time** - Memory leaks are gradual
3. **Test navigation patterns** - Navigate back and forth repeatedly
4. **Check event listeners** - Common source of leaks
5. **Be careful with closures** - They capture references

### State Management

1. **Use stable keys** - Never use array index for dynamic lists
2. **Never mutate state** - Always create new objects/arrays
3. **Colocate state** - Keep state close to where it's used
4. **Split contexts** - Avoid one giant context

### Layout Stability

1. **Set image dimensions** - Always include width/height
2. **Reserve space** - Use min-height for dynamic content
3. **Avoid top/left animations** - Use transform instead
4. **Preload fonts** - Prevent FOUT causing shifts

---

## Quick Reference

### Keyboard Shortcuts (in extension)

| Action | Key |
|--------|-----|
| Filter render events | Click filter button |
| Search events | Type in search box |
| Expand all (Redux) | Click + button |
| Collapse all (Redux) | Click - button |

### Color Coding

| Color | Meaning |
|-------|---------|
| Green | Good / Healthy |
| Yellow | Warning / Needs attention |
| Red | Error / Critical |
| Blue | Informational |

### Metric Thresholds

| Metric | Good | Warning | Poor |
|--------|------|---------|------|
| Render time | < 16ms | 16-50ms | > 50ms |
| Memory usage | < 70% | 70-90% | > 90% |
| CLS score | < 0.1 | 0.1-0.25 | > 0.25 |
| FCP | < 1.8s | 1.8-3s | > 3s |
| LCP | < 2.5s | 2.5-4s | > 4s |

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check the console for additional error messages
2. Review the Timeline tab for correlation between events
3. Take snapshots and compare before/after states
4. File an issue on the project repository

---

*React Debugger Extension - Making React debugging easier for everyone*
