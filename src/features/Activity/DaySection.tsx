import * as React from 'react';
import { css, cx } from '@emotion/css';
import { CategoryIcon } from '../../components/CategoryIcon/CategoryIcon';
import { getCategory } from '../../utilities/categories';
import { formatDay } from '../../utilities/dates';
import { formatMoney } from '../../utilities/money';
import { CARD_STYLE, TABULAR_STYLE } from '../../utilities/styles';
import {
  TransactionKind,
  type DayKey,
  type Transaction,
} from '../../utilities/types';
import type { DayGroup } from './groupByDay';

const styles = {
  root: css`
    margin-bottom: 20px;
  `,
  // Stays visible while its day scrolls by, just below the status bar.
  header: css`
    position: sticky;
    top: calc(var(--safe-top) - 16px);
    z-index: 1;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin: 0 -16px;
    padding: 8px 20px;
    background: color-mix(in srgb, var(--color-bg) 80%, transparent);
    -webkit-backdrop-filter: saturate(180%) blur(16px);
    backdrop-filter: saturate(180%) blur(16px);
    font-size: 13px;
  `,
  day: css`
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
  `,
  totals: css`
    display: flex;
    gap: 10px;
    color: var(--color-fg-secondary);
  `,
  income: css`
    color: var(--color-success);
  `,
  list: cx(
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
    min-height: 56px;
    padding: 10px 14px;
    text-align: left;
    transition: background-color 120ms ease;

    & + & {
      border-top: 1px solid var(--color-border);
    }

    &:active {
      background: var(--color-surface-raised);
    }
  `,
  name: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 500;
  `,
  amount: css`
    font-size: 15px;
    font-weight: 500;
  `,
};

export interface DaySectionProps {
  group: DayGroup;
  today: DayKey;
  currency: string;
  onSelect: (transaction: Transaction) => void;
}

interface TransactionRowProps {
  transaction: Transaction;
  currency: string;
  onSelect: (transaction: Transaction) => void;
}

/** One day of the activity list: a heading with totals and its rows. */
export const DaySection: React.FC<DaySectionProps> = ({
  group,
  today,
  currency,
  onSelect,
}) => {
  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <h2 className={styles.day}>{formatDay(group.day, today)}</h2>
        <span className={cx(styles.totals, TABULAR_STYLE)}>
          {group.incomeTotal > 0 && (
            <span className={styles.income}>
              +{formatMoney(group.incomeTotal, currency)}
            </span>
          )}
          {group.expenseTotal > 0 && (
            <span>{formatMoney(group.expenseTotal, currency)}</span>
          )}
        </span>
      </header>
      <div className={styles.list}>
        {group.transactions.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            currency={currency}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
};

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  currency,
  onSelect,
}) => {
  const category = getCategory(transaction.categoryId);
  const isIncome = category.kind === TransactionKind.Income;
  const amount = `${isIncome ? '+' : ''}${formatMoney(transaction.amount, currency)}`;

  return (
    <button
      type='button'
      aria-label={`${category.label}, ${amount}`}
      className={styles.row}
      onClick={() => onSelect(transaction)}
    >
      <CategoryIcon category={category} />
      <span className={styles.name}>{category.label}</span>
      <span
        className={cx(styles.amount, TABULAR_STYLE, isIncome && styles.income)}
      >
        {amount}
      </span>
    </button>
  );
};
