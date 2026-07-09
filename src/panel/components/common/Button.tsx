import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

export function Button({ variant = 'secondary', children, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={`${styles.button} ${styles[variant]} ${className ?? ''}`.trim()} {...rest}>
      {children}
    </button>
  );
}
