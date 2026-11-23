import * as React from 'react';
import { css } from '@emotion/css';
import type { Category } from '../../utilities/categories';

const ICON_SIZE = 18;

const styles = {
  root: css`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg);
    color: var(--color-fg);
  `,
};

export interface CategoryIconProps {
  category: Category;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ category }) => {
  return (
    <span className={styles.root} aria-hidden='true'>
      <category.icon size={ICON_SIZE} strokeWidth={1.75} />
    </span>
  );
};
