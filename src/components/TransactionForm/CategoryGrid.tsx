import * as React from 'react';
import { css, cx } from '@emotion/css';
import { getCategoriesOfKind } from '../../utilities/categories';
import { TransactionKind } from '../../utilities/types';

const ICON_SIZE = 20;

const styles = {
  root: css`
    display: grid;
    flex-shrink: 0;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
  `,
  rootIncome: css`
    grid-template-columns: repeat(4, minmax(0, 1fr));
  `,
  category: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: clamp(52px, 7.2dvh, 62px);
    border: 1px solid transparent;
    border-radius: var(--radius-m);
    color: var(--color-fg-secondary);
    font-size: 11px;
    font-weight: 500;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease,
      transform 80ms ease;

    &:active {
      transform: scale(0.96);
    }
  `,
  categorySelected: css`
    border-color: var(--color-fg);
    background: var(--color-surface-raised);
    color: var(--color-fg);
  `,
};

export interface CategoryGridProps {
  kind: TransactionKind;
  selectedId: number;
  onSelect: (categoryId: number) => void;
}

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  kind,
  selectedId,
  onSelect,
}) => {
  return (
    <div
      role='radiogroup'
      aria-label='Category'
      className={cx(
        styles.root,
        kind === TransactionKind.Income && styles.rootIncome,
      )}
    >
      {getCategoriesOfKind(kind).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type='button'
          role='radio'
          aria-checked={id === selectedId}
          className={cx(
            styles.category,
            id === selectedId && styles.categorySelected,
          )}
          onClick={() => onSelect(id)}
        >
          <Icon size={ICON_SIZE} strokeWidth={1.75} aria-hidden='true' />
          {label}
        </button>
      ))}
    </div>
  );
};
