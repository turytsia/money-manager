import * as React from 'react';
import { css, cx } from '@emotion/css';
import type { Category } from '../../utilities/categories';

const ICON_SIZE = 14;

/** Width of the soft fade on each side, the same as the screen's padding. */
const FADE_SIZE = 16;

const styles = {
  // Runs edge to edge and scrolls sideways when the chips do not fit. The
  // fade at each edge hints that there are more chips behind it.
  root: css`
    display: flex;
    gap: 6px;
    margin: -4px -16px 16px;
    padding: 0 ${FADE_SIZE}px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      #000 ${FADE_SIZE}px,
      #000 calc(100% - ${FADE_SIZE}px),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      #000 ${FADE_SIZE}px,
      #000 calc(100% - ${FADE_SIZE}px),
      transparent
    );

    &::-webkit-scrollbar {
      display: none;
    }
  `,
  chip: css`
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--color-border);
    border-radius: 17px;
    background: var(--color-surface);
    color: var(--color-fg-secondary);
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    transition:
      background-color 150ms ease,
      border-color 150ms ease,
      color 150ms ease;

    &:active {
      background: var(--color-surface-raised);
    }
  `,
  chipSelected: css`
    border-color: var(--color-fg);
    background: var(--color-fg);
    color: var(--color-inverse-fg);

    &:active {
      background: var(--color-fg);
      opacity: 0.85;
    }
  `,
};

export interface CategoryFilterProps {
  /** The categories that can be picked, in the order they are shown. */
  categories: ReadonlyArray<Category>;
  /** No ids means no filter: everything is shown. */
  selectedIds: ReadonlySet<number>;
  /** Picks a category, or drops it if it is already picked. */
  onToggle: (categoryId: number) => void;
  /** Drops every picked category, so everything is shown again. */
  onClear: () => void;
}

/**
 * A row of chips that narrows the list to some categories. Any number of
 * them can be picked at once; "All" drops them all.
 */
export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedIds,
  onToggle,
  onClear,
}) => {
  const isAllSelected = selectedIds.size === 0;

  return (
    <div role='group' aria-label='Filter by category' className={styles.root}>
      <button
        type='button'
        aria-pressed={isAllSelected}
        className={cx(styles.chip, isAllSelected && styles.chipSelected)}
        onClick={onClear}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type='button'
          aria-pressed={selectedIds.has(category.id)}
          className={cx(
            styles.chip,
            selectedIds.has(category.id) && styles.chipSelected,
          )}
          onClick={() => onToggle(category.id)}
        >
          <category.icon size={ICON_SIZE} strokeWidth={2} aria-hidden='true' />
          {category.label}
        </button>
      ))}
    </div>
  );
};
