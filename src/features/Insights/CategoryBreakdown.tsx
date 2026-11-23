import * as React from 'react';
import { css, cx } from '@emotion/css';
import { CategoryIcon } from '../../components/CategoryIcon/CategoryIcon';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar';
import { formatMoney } from '../../utilities/money';
import { CARD_STYLE, TABULAR_STYLE } from '../../utilities/styles';
import type { BreakdownItem } from './insights';

const PERCENT = 100;
const BAR_HEIGHT = 4;

const styles = {
  root: cx(
    CARD_STYLE,
    css`
      overflow: hidden;
    `,
  ),
  row: css`
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 14px;
    text-align: left;
    transition: background-color 120ms ease;

    & + & {
      border-top: 1px solid var(--color-border);
    }

    &:active {
      background: var(--color-surface-raised);
    }
  `,
  rowSelected: css`
    background: var(--color-surface-raised);
  `,
  details: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
  `,
  line: css`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    font-size: 15px;
    font-weight: 500;
  `,
  share: css`
    margin-left: 8px;
    color: var(--color-fg-secondary);
    font-size: 12px;
    font-weight: 400;
  `,
  empty: css`
    padding: 28px 16px;
    color: var(--color-fg-secondary);
    font-size: 14px;
    text-align: center;
  `,
};

export interface CategoryBreakdownProps {
  /** Categories of the selected period, largest first. */
  items: ReadonlyArray<BreakdownItem>;
  currency: string;
  selectedCategoryId: number | null;
  /** Turns the filter for a category on, or off if it is already on. */
  onToggle: (categoryId: number) => void;
}

interface BreakdownRowProps {
  item: BreakdownItem;
  /** Length of the bar relative to the largest category, from 0 to 1. */
  ratio: number;
  currency: string;
  isSelected: boolean;
  onToggle: (categoryId: number) => void;
}

/**
 * Where the money of the selected period went, as ranked bars. Bars are
 * drawn against the largest category so they are easy to compare, and each
 * row also shows its share of the total. Tapping a row filters the chart.
 */
export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  items,
  currency,
  selectedCategoryId,
  onToggle,
}) => {
  if (items.length === 0) {
    return (
      <div className={styles.root}>
        <p className={styles.empty}>Nothing recorded in this period.</p>
      </div>
    );
  }
  const largestAmount = items[0].amount;

  return (
    <div className={styles.root}>
      {items.map((item) => (
        <BreakdownRow
          key={item.category.id}
          item={item}
          ratio={item.amount / largestAmount}
          currency={currency}
          isSelected={item.category.id === selectedCategoryId}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
};

const BreakdownRow: React.FC<BreakdownRowProps> = ({
  item,
  ratio,
  currency,
  isSelected,
  onToggle,
}) => {
  const { category, amount, share } = item;
  const sharePercent = Math.round(share * PERCENT);

  return (
    <button
      type='button'
      aria-pressed={isSelected}
      className={cx(styles.row, isSelected && styles.rowSelected)}
      onClick={() => onToggle(category.id)}
    >
      <CategoryIcon category={category} />
      <span className={styles.details}>
        <span className={styles.line}>
          <span>{category.label}</span>
          <span className={TABULAR_STYLE}>
            {formatMoney(amount, currency)}
            <span className={styles.share}>{sharePercent}%</span>
          </span>
        </span>
        <ProgressBar
          ratio={ratio}
          height={BAR_HEIGHT}
          label={`${category.label}: ${sharePercent}% of the total`}
        />
      </span>
    </button>
  );
};
