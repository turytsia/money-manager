import * as React from 'react';
import { css } from '@emotion/css';
import {
  useSettings,
  useTransactions,
} from '../../components/StoreProvider/StoreProvider';
import { getBucketIndex, sumBucket } from '../../utilities/aggregation';
import { formatMonth, getBucketStart } from '../../utilities/dates';
import { formatMoney } from '../../utilities/money';
import { TABULAR_STYLE } from '../../utilities/styles';
import {
  Granularity,
  TransactionKind,
  type DayKey,
  type Transaction,
} from '../../utilities/types';
import { useToday } from '../../utilities/useToday';

const styles = {
  root: css`
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 10px;
  `,
  value: css`
    color: var(--color-fg);
    font-weight: 600;
  `,
  separator: css`
    color: var(--color-fg-tertiary);
  `,
};

/** What has been spent today and this month, shown while adding. */
export const SpendingSummary: React.FC = () => {
  const transactions = useTransactions();
  const { currency } = useSettings();
  const today = useToday();

  const spentToday = getSpent(transactions, Granularity.Day, today);
  const spentThisMonth = getSpent(transactions, Granularity.Month, today);

  return (
    <p className={styles.root}>
      <span>
        Today{' '}
        <strong className={`${styles.value} ${TABULAR_STYLE}`}>
          {formatMoney(spentToday, currency)}
        </strong>
      </span>
      <span className={styles.separator} aria-hidden='true'>
        ·
      </span>
      <span>
        {formatMonth(today)}{' '}
        <strong className={`${styles.value} ${TABULAR_STYLE}`}>
          {formatMoney(spentThisMonth, currency)}
        </strong>
      </span>
    </p>
  );
};

function getSpent(
  transactions: ReadonlyArray<Transaction>,
  granularity: Granularity,
  today: DayKey,
): number {
  const totals = getBucketIndex(transactions, granularity).get(
    getBucketStart(today, granularity),
  );
  return sumBucket(totals, TransactionKind.Expense, null).amount;
}
