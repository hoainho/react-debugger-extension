/**
 * DEBUGGING SCENARIOS FOR REACT DEBUGGER EXTENSION
 * 
 * This file contains example React components that demonstrate common 
 * performance issues and bugs that the debugger extension can detect.
 * 
 * Use these scenarios to test the extension's detection capabilities
 * and to understand how different issues manifest in real code.
 */

import React, { useState, useEffect, useCallback, useMemo, useContext, createContext } from 'react';

// ============================================
// SCENARIO 1: Excessive Re-renders
// ============================================

export function ExcessiveRerenderScenario() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(c => c + 1);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h3>Excessive Re-render Test</h3>
      <p>Count: {count}</p>
      <ExpensiveChild count={count} />
    </div>
  );
}

function ExpensiveChild({ count }: { count: number }) {
  const items = Array.from({ length: 1000 }, (_, i) => i);
  return (
    <ul>
      {items.map(item => (
        <li key={item}>{item + count}</li>
      ))}
    </ul>
  );
}

// ============================================
// SCENARIO 2: Missing Keys in List
// ============================================

export function MissingKeyScenario() {
  const [items, setItems] = useState(['Apple', 'Banana', 'Cherry']);

  const addItem = () => {
    setItems(prev => [...prev, `Item ${prev.length + 1}`]);
  };

  const removeFirst = () => {
    setItems(prev => prev.slice(1));
  };

  return (
    <div>
      <h3>Missing Key Test</h3>
      <button onClick={addItem}>Add Item</button>
      <button onClick={removeFirst}>Remove First</button>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

// ============================================
// SCENARIO 3: Stale Closure
// ============================================

export function StaleClosureScenario() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const handleClick = () => {
      console.log('Current count:', count);
    };

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <div>
      <h3>Stale Closure Test</h3>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <p>Click anywhere on the page and check console for stale value</p>
    </div>
  );
}

// ============================================
// SCENARIO 4: Missing useEffect Cleanup
// ============================================

export function MissingCleanupScenario() {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (isSubscribed) {
      setInterval(() => {
        console.log('Timer tick - this will leak if component unmounts!');
      }, 1000);
    }
  }, [isSubscribed]);

  return (
    <div>
      <h3>Missing Cleanup Test</h3>
      <button onClick={() => setIsSubscribed(!isSubscribed)}>
        {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
      </button>
    </div>
  );
}

// ============================================
// SCENARIO 5: Unnecessary Re-renders (Props)
// ============================================

const ThemeContext = createContext({ theme: 'light' });

export function UnnecessaryRerenderScenario() {
  const [count, setCount] = useState(0);
  const [, forceUpdate] = useState({});

  const data = { value: count };

  return (
    <ThemeContext.Provider value={{ theme: 'light' }}>
      <div>
        <h3>Unnecessary Re-render Test</h3>
        <button onClick={() => setCount(c => c + 1)}>Increment Count</button>
        <button onClick={() => forceUpdate({})}>Force Update</button>
        <ChildWithInlineProps data={data} onClick={() => console.log('clicked')} />
        <ChildWithContextRerender />
      </div>
    </ThemeContext.Provider>
  );
}

function ChildWithInlineProps({ data, onClick }: { data: { value: number }; onClick: () => void }) {
  console.log('ChildWithInlineProps rendered');
  return (
    <div onClick={onClick}>
      Data value: {data.value}
    </div>
  );
}

function ChildWithContextRerender() {
  const { theme } = useContext(ThemeContext);
  console.log('ChildWithContextRerender rendered');
  return <div>Theme: {theme}</div>;
}

// ============================================
// SCENARIO 6: Slow Render (>16ms)
// ============================================

export function SlowRenderScenario() {
  const [trigger, setTrigger] = useState(0);

  const expensiveCalculation = useMemo(() => {
    const start = performance.now();
    let result = 0;
    for (let i = 0; i < 10000000; i++) {
      result += Math.sqrt(i);
    }
    console.log(`Calculation took ${performance.now() - start}ms`);
    return result;
  }, [trigger]);

  return (
    <div>
      <h3>Slow Render Test</h3>
      <p>Result: {expensiveCalculation.toFixed(2)}</p>
      <button onClick={() => setTrigger(t => t + 1)}>Recalculate</button>
    </div>
  );
}

// ============================================
// SCENARIO 7: Memory Leak Pattern
// ============================================

export function MemoryLeakScenario() {
  const [data, setData] = useState<number[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setData(prev => [...prev, ...Array.from({ length: 10000 }, () => Math.random())]);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h3>Memory Leak Test</h3>
      <p>Array size: {data.length}</p>
      <p>Memory is growing continuously!</p>
    </div>
  );
}

// ============================================
// SCENARIO 8: Direct State Mutation
// ============================================

export function DirectMutationScenario() {
  const [items, setItems] = useState([{ id: 1, name: 'Item 1' }]);

  const updateItem = () => {
    items[0].name = 'Mutated!';
    setItems(items);
  };

  const addItem = () => {
    items.push({ id: items.length + 1, name: `Item ${items.length + 1}` });
    setItems(items);
  };

  return (
    <div>
      <h3>Direct Mutation Test</h3>
      <button onClick={updateItem}>Mutate First Item</button>
      <button onClick={addItem}>Add Item (Push)</button>
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}

// ============================================
// SCENARIO 9: Infinite Loop Risk
// ============================================

export function InfiniteLoopRiskScenario() {
  const [count, setCount] = useState(0);
  const [shouldUpdate, setShouldUpdate] = useState(false);

  useEffect(() => {
    if (shouldUpdate && count < 100) {
      setCount(c => c + 1);
    }
  }, [count, shouldUpdate]);

  return (
    <div>
      <h3>Infinite Loop Risk Test</h3>
      <p>Count: {count}</p>
      <button onClick={() => setShouldUpdate(!shouldUpdate)}>
        {shouldUpdate ? 'Stop' : 'Start'} Loop
      </button>
    </div>
  );
}

// ============================================
// SCENARIO 10: Optimized Component (Reference)
// ============================================

export function OptimizedScenario() {
  const [count, setCount] = useState(0);

  const handleClick = useCallback(() => {
    console.log('Clicked');
  }, []);

  const expensiveData = useMemo(() => {
    return Array.from({ length: 100 }, (_, i) => i * count);
  }, [count]);

  return (
    <div>
      <h3>Optimized Component Reference</h3>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <OptimizedChild data={expensiveData} onClick={handleClick} />
    </div>
  );
}

const OptimizedChild = React.memo(function OptimizedChild({ 
  data, 
  onClick 
}: { 
  data: number[]; 
  onClick: () => void;
}) {
  console.log('OptimizedChild rendered');
  return (
    <div onClick={onClick}>
      Data length: {data.length}
    </div>
  );
});

// ============================================
// USAGE INSTRUCTIONS
// ============================================

/**
 * HOW TO USE THESE SCENARIOS:
 * 
 * 1. Import and render any scenario in your React app
 * 2. Open Chrome DevTools and go to "React Debugger" tab
 * 3. Enable debugging by clicking the toggle
 * 4. Interact with the component
 * 5. Observe the issues detected in each tab:
 * 
 * - Timeline Tab: See render events, state changes, effects
 * - Performance Tab: See slow renders, excessive re-renders
 * - UI & State Tab: See missing keys, direct mutations
 * - Side Effects Tab: See missing cleanup, stale closures
 * - Memory Tab: Monitor heap usage and growth
 * 
 * EXPECTED DETECTIONS:
 * 
 * Scenario 1: EXCESSIVE_RERENDERS in Performance tab
 * Scenario 2: INDEX_AS_KEY warning in UI & State tab
 * Scenario 3: STALE_CLOSURE warning in Side Effects tab
 * Scenario 4: MISSING_CLEANUP warning in Side Effects tab
 * Scenario 5: UNNECESSARY_RERENDER in Performance tab
 * Scenario 6: SLOW_RENDER (>16ms) in Performance tab
 * Scenario 7: Memory growth in Memory tab
 * Scenario 8: DIRECT_STATE_MUTATION in UI & State tab
 * Scenario 9: INFINITE_LOOP_RISK in Side Effects tab
 * Scenario 10: Clean - no warnings (reference for good code)
 */

export default function DebuggingScenarios() {
  const [activeScenario, setActiveScenario] = useState<number>(0);

  const scenarios = [
    { name: 'Excessive Re-renders', component: ExcessiveRerenderScenario },
    { name: 'Missing Keys', component: MissingKeyScenario },
    { name: 'Stale Closure', component: StaleClosureScenario },
    { name: 'Missing Cleanup', component: MissingCleanupScenario },
    { name: 'Unnecessary Re-renders', component: UnnecessaryRerenderScenario },
    { name: 'Slow Render', component: SlowRenderScenario },
    { name: 'Memory Leak', component: MemoryLeakScenario },
    { name: 'Direct Mutation', component: DirectMutationScenario },
    { name: 'Infinite Loop Risk', component: InfiniteLoopRiskScenario },
    { name: 'Optimized (Reference)', component: OptimizedScenario },
  ];

  const ActiveComponent = scenarios[activeScenario].component;

  return (
    <div style={{ padding: '20px' }}>
      <h1>React Debugger Test Scenarios</h1>
      <div style={{ marginBottom: '20px' }}>
        {scenarios.map((scenario, index) => (
          <button
            key={scenario.name}
            onClick={() => setActiveScenario(index)}
            style={{
              margin: '4px',
              padding: '8px 12px',
              background: activeScenario === index ? '#007acc' : '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {scenario.name}
          </button>
        ))}
      </div>
      <div style={{ 
        padding: '20px', 
        background: '#1e1e1e', 
        borderRadius: '8px',
        color: '#fff'
      }}>
        <ActiveComponent />
      </div>
    </div>
  );
}
