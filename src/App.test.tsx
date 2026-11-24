import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { createMemoryCloud } from './test/mocks/memoryCloud';
import { createProviders, Providers } from './test/Providers';

describe('App', () => {
  beforeEach(() => {
    // Only the date is fixed (to Monday, 23 November 2026); timers stay real.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 23, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not allow adding before an amount is typed', () => {
    render(<App />, { wrapper: Providers });

    expect(screen.getByRole('button', { name: 'Add expense' })).toBeDisabled();
  });

  describe('when an amount is typed and a category is picked', () => {
    it('should save the expense and clear the form for the next one', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: Providers });

      await addExpense(user);

      expect(screen.getByText('Added $12.50 to Groceries')).toBeVisible();
      expect(screen.getByRole('status', { name: 'Amount' })).toHaveTextContent(
        '$0',
      );
      expect(
        JSON.parse(localStorage.getItem('mm:tx:202611') ?? '')[0].slice(1),
      ).toEqual([23, 2, 1250]);
    });

    it('should list the expense under today in Activity', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: Providers });

      await addExpense(user);
      await user.click(screen.getByRole('button', { name: 'Activity' }));

      expect(screen.getByRole('heading', { name: 'Today' })).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'Groceries, $12.50' }),
      ).toBeVisible();
    });

    it('should total it for the current month in Insights', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: Providers });

      await addExpense(user);
      await user.click(screen.getByRole('button', { name: 'Insights' }));

      const insights = screen.getByRole('region', { name: 'Insights' });
      expect(
        within(insights).getByRole('heading', { name: 'November 2026' }),
      ).toBeVisible();
      expect(
        within(insights).getByRole('button', { name: /Groceries/ }),
      ).toHaveTextContent('$12.50100%');
    });

    it('should not confirm it again after a visit to another tab', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: Providers });

      await addExpense(user);

      expect(screen.getByText('Saved')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Activity' }));
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() =>
        expect(screen.queryByText('Saved')).not.toBeInTheDocument(),
      );
    });
  });

  describe('when Undo is pressed right after adding', () => {
    it('should remove the expense again', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: Providers });

      await addExpense(user);
      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(localStorage.getItem('mm:tx:202611')).toBeNull();
    });
  });

  describe('when a saved transaction is opened', () => {
    it('should save a changed amount', async () => {
      const user = userEvent.setup();
      localStorage.setItem('mm:tx:202611', '[["a1",23,2,1250]]');
      render(<App />, { wrapper: Providers });

      await user.click(screen.getByRole('button', { name: 'Activity' }));
      await user.click(
        screen.getByRole('button', { name: 'Groceries, $12.50' }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Edit transaction' });
      await user.click(
        within(dialog).getByRole('button', { name: 'Delete last digit' }),
      );
      await user.click(within(dialog).getByRole('button', { name: '9' }));
      await user.click(
        within(dialog).getByRole('button', { name: 'Save changes' }),
      );

      expect(localStorage.getItem('mm:tx:202611')).toBe('[["a1",23,2,1259]]');
    });

    it('should delete it and put it back on Undo', async () => {
      const user = userEvent.setup();
      localStorage.setItem('mm:tx:202611', '[["a1",23,2,1250]]');
      render(<App />, { wrapper: Providers });

      await user.click(screen.getByRole('button', { name: 'Activity' }));
      await user.click(
        screen.getByRole('button', { name: 'Groceries, $12.50' }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Edit transaction' });
      await user.click(
        within(dialog).getByRole('button', { name: 'Delete transaction' }),
      );
      // The test browser does not run animations, so end the closing one here.
      fireEvent.animationEnd(dialog);

      expect(localStorage.getItem('mm:tx:202611')).toBeNull();
      expect(
        screen.queryByRole('dialog', { name: 'Edit transaction' }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(localStorage.getItem('mm:tx:202611')).toBe('[["a1",23,2,1250]]');
    });
  });

  describe('when a backup file is imported in Settings', () => {
    it('should add its transactions after confirmation', async () => {
      const user = userEvent.setup();
      const backup = new File(
        [
          JSON.stringify({
            app: 'money-manager',
            version: 1,
            currency: 'EUR',
            transactions: [
              { id: 'b1', date: '2026-10-05', category: 'food', amount: 8 },
            ],
          }),
        ],
        'backup.json',
        { type: 'application/json' },
      );
      render(<App />, { wrapper: Providers });

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      await user.upload(screen.getByLabelText('Backup file'), backup);
      const dialog = await screen.findByRole('dialog', {
        name: 'Import backup',
      });
      await user.click(within(dialog).getByRole('button', { name: 'Import' }));

      expect(screen.getByText('Imported 1 transaction')).toBeVisible();
      expect(localStorage.getItem('mm:tx:202610')).toBe('[["b1",5,1,800]]');
      expect(screen.getByRole('combobox')).toHaveValue('EUR');
    });
  });

  describe('when a category is created while adding an expense', () => {
    it('should select the new category and save the expense in it', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: Providers });

      await user.click(screen.getByRole('button', { name: 'Edit categories' }));
      const manager = screen.getByRole('dialog', { name: 'Categories' });
      await user.click(
        within(manager).getByRole('button', { name: 'New category' }),
      );
      const editor = screen.getByRole('dialog', { name: 'New category' });
      await user.type(within(editor).getByLabelText('Name'), 'Pets');
      await user.click(within(editor).getByRole('radio', { name: 'Dog' }));
      await user.click(within(editor).getByRole('button', { name: 'Save' }));
      fireEvent.animationEnd(editor);
      await user.click(within(manager).getByRole('button', { name: 'Done' }));
      fireEvent.animationEnd(manager);

      expect(screen.getByRole('radio', { name: 'Pets' })).toBeChecked();

      await user.click(screen.getByRole('button', { name: '7' }));
      await user.click(screen.getByRole('button', { name: 'Add expense' }));

      expect(screen.getByText('Added $7 to Pets')).toBeVisible();
      const [category] = JSON.parse(
        localStorage.getItem('mm:categories') ?? '',
      );
      expect(category).toMatchObject({
        kind: 'expense',
        label: 'Pets',
        icon: 'dog',
      });
      expect(
        JSON.parse(localStorage.getItem('mm:tx:202611') ?? '')[0].slice(1),
      ).toEqual([23, category.id, 700]);
    });

    it('should not allow a name that is already taken', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: Providers });

      await user.click(screen.getByRole('button', { name: 'Edit categories' }));
      await user.click(screen.getByRole('button', { name: 'New category' }));
      const editor = screen.getByRole('dialog', { name: 'New category' });
      await user.type(within(editor).getByLabelText('Name'), 'food');
      await user.click(within(editor).getByRole('button', { name: 'Save' }));

      expect(within(editor).getByRole('alert')).toHaveTextContent(
        'A category with this name already exists',
      );
      expect(localStorage.getItem('mm:categories')).toBeNull();
    });
  });

  describe('when a category is turned off', () => {
    it('should no longer be offered when adding', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: Providers });

      await user.click(screen.getByRole('button', { name: 'Edit categories' }));
      const manager = screen.getByRole('dialog', { name: 'Categories' });
      await user.click(
        within(manager).getByRole('switch', { name: 'Show Transport' }),
      );
      await user.click(within(manager).getByRole('button', { name: 'Done' }));
      fireEvent.animationEnd(manager);

      expect(
        screen.queryByRole('radio', { name: 'Transport' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Food' })).toBeVisible();
      expect(localStorage.getItem('mm:hidden')).toBe('[3]');
    });

    it('should keep the last category of a type on', async () => {
      const user = userEvent.setup();
      localStorage.setItem('mm:hidden', '[2,3,4,5,6,7,8]');
      render(<App />, { wrapper: Providers });

      await user.click(screen.getByRole('button', { name: 'Edit categories' }));
      const manager = screen.getByRole('dialog', { name: 'Categories' });

      expect(
        within(manager).getByRole('switch', { name: 'Show Food' }),
      ).toBeDisabled();
      expect(
        within(manager).getByRole('switch', { name: 'Show Groceries' }),
      ).toBeEnabled();
    });

    it('should not list a category called Other', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: Providers });

      expect(
        screen.queryByRole('radio', { name: 'Other' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('radio', { name: 'Uncategorized' }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Edit categories' }));
      const manager = screen.getByRole('dialog', { name: 'Categories' });

      expect(within(manager).queryByText('Other')).not.toBeInTheDocument();
      expect(
        within(manager).queryByText('Uncategorized'),
      ).not.toBeInTheDocument();
    });

    it('should still show on a transaction that already has it', async () => {
      const user = userEvent.setup();
      localStorage.setItem('mm:hidden', '[3]');
      localStorage.setItem('mm:tx:202611', '[["a1",23,3,1250]]');
      render(<App />, { wrapper: Providers });

      await user.click(screen.getByRole('button', { name: 'Activity' }));
      await user.click(
        screen.getByRole('button', { name: 'Transport, $12.50' }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Edit transaction' });

      expect(
        within(dialog).getByRole('radio', { name: 'Transport' }),
      ).toBeChecked();
    });
  });

  describe('when a custom category is deleted', () => {
    it('should keep its transactions as Uncategorized', async () => {
      const user = userEvent.setup();
      localStorage.setItem(
        'mm:categories',
        '[{"id":1000,"kind":"expense","label":"Pets","icon":"dog"}]',
      );
      localStorage.setItem('mm:tx:202611', '[["a1",23,1000,700]]');
      render(<App />, { wrapper: Providers });

      await user.click(screen.getByRole('button', { name: 'Edit categories' }));
      const manager = screen.getByRole('dialog', { name: 'Categories' });
      await user.click(
        within(manager).getByRole('button', { name: 'Edit Pets' }),
      );
      const editor = screen.getByRole('dialog', { name: 'Edit category' });
      await user.click(
        within(editor).getByRole('button', { name: 'Delete category' }),
      );

      expect(
        within(editor).getByText(
          /Its 1 transaction will be kept as Uncategorized/,
        ),
      ).toBeVisible();

      await user.click(
        within(editor).getByRole('button', { name: 'Delete category' }),
      );

      expect(screen.getByText('Deleted Pets')).toBeVisible();
      expect(localStorage.getItem('mm:categories')).toBeNull();
      expect(localStorage.getItem('mm:tx:202611')).toBe('[["a1",23,9,700]]');
    });
  });

  describe('when cloud sync is turned on in Settings', () => {
    it('should send the data on this device to the cloud', async () => {
      const user = userEvent.setup();
      const cloud = createMemoryCloud();
      localStorage.setItem('mm:tx:202611', '[["a1",23,2,1250]]');
      render(<App />, { wrapper: createProviders(cloud) });

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      await user.type(screen.getByLabelText('Sync password'), 'secret');
      await user.click(screen.getByRole('button', { name: 'Turn on' }));

      expect(await screen.findByText('Cloud sync is on')).toBeVisible();
      expect(screen.getByText('Up to date')).toBeVisible();
      expect(cloud.getDocument()).toMatchObject({
        transactions: [
          { id: 'a1', date: '2026-11-23', category: 'groceries', amount: 12.5 },
        ],
      });
    });

    it('should bring back the data kept in the cloud', async () => {
      const user = userEvent.setup();
      const cloud = createMemoryCloud();
      cloud.saveFromOtherDevice({
        app: 'money-manager',
        version: 2,
        currency: 'USD',
        transactions: [
          { id: 'r1', date: '2026-11-23', category: 'food', amount: 8 },
        ],
      });
      render(<App />, { wrapper: createProviders(cloud) });

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      await user.type(screen.getByLabelText('Sync password'), 'secret');
      await user.click(screen.getByRole('button', { name: 'Turn on' }));
      await screen.findByText('Cloud sync is on');
      await user.click(screen.getByRole('button', { name: 'Activity' }));

      expect(screen.getByRole('button', { name: 'Food, $8' })).toBeVisible();
    });

    it('should say so when the password is wrong', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: createProviders(createMemoryCloud()) });

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      await user.type(screen.getByLabelText('Sync password'), 'wrong');
      await user.click(screen.getByRole('button', { name: 'Turn on' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'That password is not right.',
      );
      expect(localStorage.getItem('mm:sync')).toBeNull();
    });

    it('should stop syncing when it is turned off again', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: createProviders(createMemoryCloud()) });

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      await user.type(screen.getByLabelText('Sync password'), 'secret');
      await user.click(screen.getByRole('button', { name: 'Turn on' }));
      await user.click(await screen.findByRole('button', { name: 'Turn off' }));

      expect(screen.getByLabelText('Sync password')).toBeVisible();
      expect(localStorage.getItem('mm:sync')).toBeNull();
    });
  });
});

async function addExpense(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole('button', { name: '1' }));
  await user.click(screen.getByRole('button', { name: '2' }));
  await user.click(screen.getByRole('button', { name: 'Decimal point' }));
  await user.click(screen.getByRole('button', { name: '5' }));
  await user.click(screen.getByRole('radio', { name: 'Groceries' }));
  await user.click(screen.getByRole('button', { name: 'Add expense' }));
}
