import * as React from 'react';
import { css } from '@emotion/css';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import { CategoryManagerSheet } from '../../components/CategoryEditor/CategoryManagerSheet';
import { useCategories } from '../../components/StoreProvider/StoreProvider';
import { formatCount } from '../../utilities/text';
import { SettingsSection } from './SettingsSection';

const styles = {
  note: css`
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
};

/** Opens the list where categories are shown, hidden, added and edited. */
export const CategoriesSection: React.FC = () => {
  const categories = useCategories();
  const [isManaging, setIsManaging] = React.useState(false);
  const hiddenCount = categories.hiddenIds.size;
  const shownCount = categories.all.length - hiddenCount;

  return (
    <SettingsSection title='Categories'>
      <p className={styles.note}>
        Choose which categories you see when adding, and make your own.{' '}
        {formatCount(shownCount, 'category', 'categories')} shown
        {hiddenCount > 0 && `, ${hiddenCount} hidden`}.
      </p>
      <Button onClick={() => setIsManaging(true)}>
        <SlidersHorizontal size={16} aria-hidden='true' />
        Manage categories
      </Button>
      {isManaging && (
        <CategoryManagerSheet onClose={() => setIsManaging(false)} />
      )}
    </SettingsSection>
  );
};
