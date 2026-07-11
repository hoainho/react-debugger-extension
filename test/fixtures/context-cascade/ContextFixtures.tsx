import React, { createContext, useContext, useMemo, useState } from 'react';

const ThemeContext = createContext<{ color: string }>({ color: 'black' });

function ConsumerA() {
  const t = useContext(ThemeContext);
  return <span>{t.color}</span>;
}
function ConsumerB() {
  const t = useContext(ThemeContext);
  return <strong>{t.color}</strong>;
}

/**
 * ANTI-PATTERN (positive): a NEW value object literal on every render, so its
 * reference changes each commit and both consumers re-render — the detector
 * flags CONTEXT_CASCADE.
 */
export const CascadingProvider: React.FC = () => {
  const [color, setColor] = useState('black');
  return (
    <ThemeContext.Provider value={{ color }}>
      <button onClick={() => setColor((c) => (c === 'black' ? 'white' : 'black'))}>toggle</button>
      <ConsumerA />
      <ConsumerB />
    </ThemeContext.Provider>
  );
};

/**
 * CORRECT (negative): the value is memoized, so its reference is stable across
 * commits — consumers don't cascade and the detector stays quiet.
 */
export const StableProvider: React.FC = () => {
  const [color, setColor] = useState('black');
  const value = useMemo(() => ({ color }), [color]);
  return (
    <ThemeContext.Provider value={value}>
      <ConsumerA />
      <ConsumerB />
    </ThemeContext.Provider>
  );
};
