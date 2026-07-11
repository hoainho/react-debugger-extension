import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type BadgeSeverity = 'error' | 'warning' | 'info' | 'ok';

export interface BadgeProps {
  severity?: BadgeSeverity;
  children: ReactNode;
}

/** Severity chip built on CSS Modules + design tokens (S4 card system). */
export function Badge({ severity = 'info', children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[severity]}`} data-severity={severity}>
      {children}
    </span>
  );
}
