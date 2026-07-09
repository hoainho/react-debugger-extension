import type { CSSProperties, ReactNode } from 'react';
import styles from './Card.module.css';
import type { BadgeSeverity } from './Badge';

export interface CardProps {
  title?: ReactNode;
  severity?: BadgeSeverity;
  children: ReactNode;
}

/** Card with an optional severity stripe (left border), for the card system. */
export function Card({ title, severity, children }: CardProps) {
  const style: CSSProperties | undefined = severity
    ? { borderLeftColor: `var(--severity-${severity})` }
    : undefined;
  return (
    <section className={styles.card} data-severity={severity} style={style}>
      {title != null && <header className={styles.header}>{title}</header>}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
