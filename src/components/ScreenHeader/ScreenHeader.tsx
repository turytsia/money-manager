import * as React from 'react';
import { css } from '@emotion/css';

const styles = {
  root: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 40px;
    margin-bottom: 16px;
  `,
  title: css`
    font-size: 28px;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.04em;
  `,
};

export interface ScreenHeaderProps {
  title: string;
  /** Optional controls shown on the right side of the header. */
  children?: React.ReactNode;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  children,
}) => {
  return (
    <header className={styles.root}>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </header>
  );
};
