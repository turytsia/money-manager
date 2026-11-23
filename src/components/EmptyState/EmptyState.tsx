import * as React from 'react';
import { css } from '@emotion/css';
import type { LucideIcon } from 'lucide-react';

const ICON_SIZE = 22;

const styles = {
  root: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 72px 24px;
    text-align: center;
  `,
  icon: css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    margin-bottom: 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-m);
    background: var(--color-surface);
    color: var(--color-fg-secondary);
  `,
  title: css`
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.02em;
  `,
  description: css`
    max-width: 260px;
    color: var(--color-fg-secondary);
    font-size: 14px;
  `,
};

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
}) => {
  return (
    <div className={styles.root}>
      <span className={styles.icon}>
        <Icon size={ICON_SIZE} strokeWidth={1.75} aria-hidden='true' />
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
    </div>
  );
};
