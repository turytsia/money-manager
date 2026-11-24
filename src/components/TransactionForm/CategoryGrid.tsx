import * as React from 'react';
import { css, cx } from '@emotion/css';
import { SlidersHorizontal } from 'lucide-react';
import type { TransactionKind } from '../../utilities/types';
import { CategoryManagerSheet } from '../CategoryEditor/CategoryManagerSheet';
import { useCategories } from '../StoreProvider/StoreProvider';

const ICON_SIZE = 20;
const COLUMN_COUNT = 5;

/** Rows that stay in view when the grid has to scroll on short screens. */
const MIN_VISIBLE_ROWS = 2;

/** How much of the next row peeks out, as a hint that the grid scrolls. */
const PEEK_ROW_FRACTION = 0.3;

const SELECTED_SELECTOR = '[aria-checked="true"]';

/** Height of the soft fade on an edge that has more categories behind it. */
const FADE_SIZE = 18;

/** Allows for rounding, so an edge reached exactly still counts as reached. */
const SCROLL_TOLERANCE = 1;

const styles = {
  root: css`
    --tile-height: clamp(48px, 6.6dvh, 56px);
    display: grid;
    flex-shrink: 0;
    grid-template-columns: repeat(${COLUMN_COUNT}, minmax(0, 1fr));
    grid-auto-rows: var(--tile-height);
    gap: 6px;
  `,
  // With more rows than fit, the grid first takes room from the space around
  // the amount, and only then scrolls.
  scrollable: css`
    flex: 0 1 auto;
    min-height: calc(
      var(--tile-height) * ${MIN_VISIBLE_ROWS + PEEK_ROW_FRACTION} +
        ${MIN_VISIBLE_ROWS * 6}px
    );
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  `,
  fadeTop: css`
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent,
      #000 ${FADE_SIZE}px
    );
    mask-image: linear-gradient(to bottom, transparent, #000 ${FADE_SIZE}px);
  `,
  fadeBottom: css`
    -webkit-mask-image: linear-gradient(
      to top,
      transparent,
      #000 ${FADE_SIZE}px
    );
    mask-image: linear-gradient(to top, transparent, #000 ${FADE_SIZE}px);
  `,
  fadeBoth: css`
    -webkit-mask-image: linear-gradient(
      to bottom,
      transparent,
      #000 ${FADE_SIZE}px,
      #000 calc(100% - ${FADE_SIZE}px),
      transparent
    );
    mask-image: linear-gradient(
      to bottom,
      transparent,
      #000 ${FADE_SIZE}px,
      #000 calc(100% - ${FADE_SIZE}px),
      transparent
    );
  `,
  category: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    padding: 0 4px;
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
  edit: css`
    border: 1px dashed var(--color-border-strong);
    color: var(--color-fg-tertiary);

    &:active {
      color: var(--color-fg);
    }
  `,
  label: css`
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
};

/** Which edges of the grid have more categories scrolled out of view. */
enum ScrollFade {
  None = 'none',
  Top = 'top',
  Bottom = 'bottom',
  Both = 'both',
}

export interface CategoryGridProps {
  kind: TransactionKind;
  selectedId: number;
  /** A hidden category that is shown anyway, because it is in use here. */
  keptId?: number;
  onSelect: (categoryId: number) => void;
}

/**
 * The categories of one type that the user has not turned off, followed
 * by a tile that opens the list to change them. A category created from
 * there is selected right away.
 */
export const CategoryGrid: React.FC<CategoryGridProps> = ({
  kind,
  selectedId,
  keptId,
  onSelect,
}) => {
  const catalog = useCategories();
  const grid = React.useRef<HTMLDivElement>(null);
  const [isManaging, setIsManaging] = React.useState(false);
  const [fade, setFade] = React.useState(ScrollFade.None);
  const categories = catalog.byKind[kind].filter(
    ({ id }) => !catalog.hiddenIds.has(id) || id === keptId,
  );
  const rowCount = Math.ceil((categories.length + 1) / COLUMN_COUNT);

  // On short screens the selection can be in a row scrolled out of view.
  React.useEffect(() => {
    grid.current
      ?.querySelector(SELECTED_SELECTOR)
      ?.scrollIntoView({ block: 'nearest' });
    setFade(getScrollFade(grid.current));
  }, [kind, selectedId, rowCount]);

  return (
    <>
      <div
        ref={grid}
        role='group'
        aria-label='Category'
        className={cx(
          styles.root,
          rowCount > MIN_VISIBLE_ROWS && styles.scrollable,
          fade === ScrollFade.Top && styles.fadeTop,
          fade === ScrollFade.Bottom && styles.fadeBottom,
          fade === ScrollFade.Both && styles.fadeBoth,
        )}
        onScroll={(event) => setFade(getScrollFade(event.currentTarget))}
      >
        {categories.map(({ id, label, icon: Icon }) => (
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
            <span className={styles.label}>{label}</span>
          </button>
        ))}
        <button
          type='button'
          aria-label='Edit categories'
          className={cx(styles.category, styles.edit)}
          onClick={() => setIsManaging(true)}
        >
          <SlidersHorizontal
            size={ICON_SIZE}
            strokeWidth={1.75}
            aria-hidden='true'
          />
          <span className={styles.label}>Edit</span>
        </button>
      </div>
      {isManaging && (
        <CategoryManagerSheet
          initialKind={kind}
          onCreated={({ id }) => onSelect(id)}
          onClose={() => setIsManaging(false)}
        />
      )}
    </>
  );
};

function getScrollFade(element: HTMLElement | null): ScrollFade {
  if (!element) {
    return ScrollFade.None;
  }
  const { scrollTop, clientHeight, scrollHeight } = element;
  const hasMoreAbove = scrollTop > SCROLL_TOLERANCE;
  const hasMoreBelow =
    scrollTop + clientHeight < scrollHeight - SCROLL_TOLERANCE;
  if (hasMoreAbove && hasMoreBelow) {
    return ScrollFade.Both;
  }
  if (hasMoreAbove) {
    return ScrollFade.Top;
  }
  return hasMoreBelow ? ScrollFade.Bottom : ScrollFade.None;
}
