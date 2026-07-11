import React from 'react';

interface Item {
  id: string;
  label: string;
}

/**
 * CORRECT fixture (negative case).
 *
 * Keys come from a stable `item.id`, so reordering the list preserves child
 * identity across commits and React reuses the existing DOM nodes. The
 * reconciler-keys detector stays quiet — even when the list is reordered.
 */
export const StableList: React.FC<{ items: Item[] }> = ({ items }) => (
  <ul>
    {items.map((item) => (
      <li key={item.id}>{item.label}</li>
    ))}
  </ul>
);

export default StableList;
