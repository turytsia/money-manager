import { getKind } from '../../utilities/transactions';
import {
  TransactionKind,
  type DayKey,
  type Transaction,
} from '../../utilities/types';

export interface DayGroup {
  day: DayKey;
  transactions: Array<Transaction>;
  expenseTotal: number;
  incomeTotal: number;
}

/**
 * Splits transactions into one group per day. The input is already sorted
 * newest first, so a single pass is enough and the groups keep that order.
 */
export function groupByDay(
  transactions: ReadonlyArray<Transaction>,
): Array<DayGroup> {
  const groups: Array<DayGroup> = [];
  for (const transaction of transactions) {
    const lastGroup = groups.at(-1);
    const group =
      lastGroup?.day === transaction.day
        ? lastGroup
        : createGroup(transaction.day);
    if (group !== lastGroup) {
      groups.push(group);
    }
    group.transactions.push(transaction);
    if (getKind(transaction) === TransactionKind.Expense) {
      group.expenseTotal += transaction.amount;
    } else {
      group.incomeTotal += transaction.amount;
    }
  }
  return groups;
}

function createGroup(day: DayKey): DayGroup {
  return { day, transactions: [], expenseTotal: 0, incomeTotal: 0 };
}
