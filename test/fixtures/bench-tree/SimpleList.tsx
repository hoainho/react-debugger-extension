import React from 'react';

interface SimpleListProps {
  count: number;
}

const SimpleList: React.FC<SimpleListProps> = ({ count }) => (
  <ul>
    {Array.from({ length: count }, (_, index) => (
      <li key={index}>item-{index}</li>
    ))}
  </ul>
);

export default SimpleList;
