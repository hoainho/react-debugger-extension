import React from 'react';

/**
 * ANTI-PATTERN fixture (positive case).
 *
 * Each render generates fresh `Math.random()` keys, so every list child is a
 * brand-new key on every commit — React tears down and rebuilds the whole
 * list. The reconciler-keys detector flags this as `UNSTABLE_LIST_KEY`
 * (Case A) on the first commit.
 *
 * A `key={index}`-with-reorder variant is the other positive signal (Case B);
 * see `indexKeysInitial` / `indexKeysReordered` in `./keys.ts`.
 */
export const UnstableList: React.FC<{ items: string[] }> = ({ items }) => (
  <ul>
    {items.map((label) => (
      <li key={Math.random()}>{label}</li>
    ))}
  </ul>
);

export default UnstableList;
