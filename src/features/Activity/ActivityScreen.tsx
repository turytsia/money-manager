import * as React from 'react';
import { css } from '@emotion/css';
import { ListFilter, ReceiptText } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { ScreenHeader } from '../../components/ScreenHeader/ScreenHeader';
import {
  useCategories,
  useSettings,
  useTransactions,
} from '../../components/StoreProvider/StoreProvider';
import { SCREEN_STYLE } from '../../utilities/styles';
import { formatCount } from '../../utilities/text';
import type { Transaction } from '../../utilities/types';
import { useToday } from '../../utilities/useToday';
import { buildActivity } from './activity';
import { CategoryFilter } from './CategoryFilter';
import { DaySection } from './DaySection';
import { EditTransactionSheet } from './EditTransactionSheet';

/** Days shown at first, and added each time the end of the list is reached. */
const PAGE_SIZE = 30;

const NO_CATEGORIES: ReadonlySet<number> = new Set();

/** Starts loading the next page a little before the end scrolls into view. */
const LOAD_MORE_MARGIN = '400px';

const styles = {
  count: css`
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
  loadMore: css`
    display: flex;
    justify-content: center;
    padding: 4px 0 16px;
  `,
};

interface LoadMoreProps {
  onLoadMore: () => void;
}

/**
 * Every transaction, newest first, grouped by day. Tap one to edit it. The
 * chips at the top narrow the list to some categories.
 */
export const ActivityScreen: React.FC = () => {
  const transactions = useTransactions();
  const categories = useCategories();
  const { currency } = useSettings();
  const today = useToday();
  const [visibleDayCount, setVisibleDayCount] = React.useState(PAGE_SIZE);
  const [categoryIds, setCategoryIds] = React.useState(NO_CATEGORIES);
  const [editedTransaction, setEditedTransaction] =
    React.useState<Transaction | null>(null);

  // This reads every transaction, so it only reruns when data or the
  // filter changes.
  const { selectedIds, filterCategories, groups, count } = React.useMemo(
    () => buildActivity({ transactions, categories, categoryIds }),
    [transactions, categories, categoryIds],
  );
  const isFiltered = selectedIds.size > 0;
  // With a single category in use there is nothing to choose between.
  const hasFilter = filterCategories.length > 1 || isFiltered;

  const handleCategoryToggle = (toggledId: number): void => {
    const next = new Set(selectedIds);
    if (!next.delete(toggledId)) {
      next.add(toggledId);
    }
    setCategoryIds(next);
  };

  return (
    <section aria-label='Activity' className={SCREEN_STYLE}>
      <ScreenHeader title='Activity'>
        {transactions.length > 0 && (
          <span className={styles.count}>
            {formatCount(count, 'transaction')}
          </span>
        )}
      </ScreenHeader>
      {hasFilter && (
        <CategoryFilter
          categories={filterCategories}
          selectedIds={selectedIds}
          onToggle={handleCategoryToggle}
          onClear={() => setCategoryIds(NO_CATEGORIES)}
        />
      )}
      {transactions.length === 0 && (
        <EmptyState
          icon={ReceiptText}
          title='No transactions yet'
          description='Everything you add shows up here, grouped by day.'
        />
      )}
      {transactions.length > 0 && groups.length === 0 && (
        <EmptyState
          icon={ListFilter}
          title='Nothing in these categories'
          description='Pick other categories, or tap All to see everything.'
        />
      )}
      {groups.slice(0, visibleDayCount).map((group) => (
        <DaySection
          key={group.day}
          group={group}
          today={today}
          currency={currency}
          categories={categories}
          onSelect={setEditedTransaction}
        />
      ))}
      {visibleDayCount < groups.length && (
        <LoadMore
          onLoadMore={() => setVisibleDayCount((count) => count + PAGE_SIZE)}
        />
      )}
      {editedTransaction && (
        <EditTransactionSheet
          key={editedTransaction.id}
          transaction={editedTransaction}
          onClose={() => setEditedTransaction(null)}
        />
      )}
    </section>
  );
};

/**
 * Long histories are shown a page at a time to keep scrolling smooth. More
 * days load on their own near the end of the list; the button is a fallback.
 */
const LoadMore: React.FC<LoadMoreProps> = ({ onLoadMore }) => {
  const container = React.useRef<HTMLDivElement>(null);
  const handleVisible = React.useEffectEvent(onLoadMore);

  React.useEffect(() => {
    if (!container.current || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          handleVisible();
        }
      },
      { rootMargin: LOAD_MORE_MARGIN },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={container} className={styles.loadMore}>
      <Button onClick={onLoadMore}>Show older</Button>
    </div>
  );
};
