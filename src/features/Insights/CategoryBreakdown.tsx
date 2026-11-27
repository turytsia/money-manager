import * as React from 'react';
import { css, cx } from '@emotion/css';
import { CategoryIcon } from '../../components/CategoryIcon/CategoryIcon';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar';
import { formatMoney } from '../../utilities/money';
import { CARD_STYLE, TABULAR_STYLE } from '../../utilities/styles';
import { TransactionKind } from '../../utilities/types';
import type { BreakdownItem } from './insights';

const PERCENT = 100;
const BAR_HEIGHT = 4;

const styles = {
  root: cx(
    CARD_STYLE,
    css`
      margin: 0;
      padding: 0;
      overflow: hidden;
      list-style: none;
    `,
  ),
  row: css`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;

    & + & {
      border-top: 1px solid var(--color-border);
    }
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
  // The bars use the color of their series in the chart above.
  [TransactionKind.Income]: css`
    color: var(--color-series-earned);
  `,
  [TransactionKind.Expense]: css`
    color: var(--color-series-spent);
  `,
  empty: css`
    padding: 28px 16px;
    color: var(--color-fg-secondary);
    font-size: 14px;
    text-align: center;
  `,
};

export interface CategoryBreakdownProps {
  /** Names the list for screen readers. It is not shown. */
  label: string;
  /** Categories of the selected period, largest first. */
  items: ReadonlyArray<BreakdownItem>;
  currency: string;
}

interface BreakdownRowProps {
  item: BreakdownItem;
  /** Length of the bar relative to the largest category, from 0 to 1. */
  ratio: number;
  currency: string;
}

/**
 * Where the money of the selected period went, or came from, as ranked
 * bars. Bars are drawn against the largest category so they are easy to
 * compare, and each row also shows its share of the total.
 */
export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({
  label,
  items,
  currency,
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
    <ul aria-label={label} className={styles.root}>
      {items.map((item) => (
        <BreakdownRow
          key={item.category.id}
          item={item}
          ratio={item.amount / largestAmount}
          currency={currency}
        />
      ))}
    </ul>
  );
};

const BreakdownRow: React.FC<BreakdownRowProps> = ({
  item,
  ratio,
  currency,
}) => {
  const { category, amount, share } = item;
  const sharePercent = Math.round(share * PERCENT);

  return (
    <li className={styles.row}>
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
          className={styles[category.kind]}
        />
      </span>
    </li>
  );
};
