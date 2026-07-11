import React from 'react';

/**
 * ANTI-PATTERN (positive): renders non-deterministic, client-only content
 * during render, so the server HTML and the client's first render disagree →
 * React logs a hydration mismatch the detector flags.
 */
export const MismatchingGreeting: React.FC = () => (
  <div>{new Date().getHours() < 12 ? 'Good morning' : 'Good evening'}</div>
);

/**
 * CORRECT (negative): deterministic render — the greeting is passed in as a
 * prop resolved identically on server and client, so hydration is clean.
 */
export const StableGreeting: React.FC<{ greeting: string }> = ({ greeting }) => (
  <div>{greeting}</div>
);
