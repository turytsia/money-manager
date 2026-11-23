import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { Providers } from './test/Providers';

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

      await user.click(screen.getByRole('button', { name: 'New category' }));
      const dialog = screen.getByRole('dialog', { name: 'New category' });
      await user.type(within(dialog).getByLabelText('Name'), 'Pets');
      await user.click(within(dialog).getByRole('radio', { name: 'Dog' }));
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      fireEvent.animationEnd(dialog);

      expect(screen.getByRole('radio', { name: 'Pets' })).toBeChecked();

      await user.click(screen.getByRole('button', { name: '7' }));
      await user.click(screen.getByRole('button', { name: 'Add expense' }));

      expect(screen.getByText('Added $7 to Pets')).toBeVisible();
      expect(localStorage.getItem('mm:categories')).toBe(
        '[{"id":1000,"kind":"expense","label":"Pets","icon":"dog"}]',
      );
      expect(
        JSON.parse(localStorage.getItem('mm:tx:202611') ?? '')[0].slice(1),
      ).toEqual([23, 1000, 700]);
    });

    it('should not allow a name that is already taken', async () => {
      const user = userEvent.setup();
      render(<App />, { wrapper: Providers });

      await user.click(screen.getByRole('button', { name: 'New category' }));
      const dialog = screen.getByRole('dialog', { name: 'New category' });
      await user.type(within(dialog).getByLabelText('Name'), 'food');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(within(dialog).getByRole('alert')).toHaveTextContent(
        'A category with this name already exists',
      );
      expect(localStorage.getItem('mm:categories')).toBeNull();
    });
  });

  describe('when a custom category is deleted in Settings', () => {
    it('should move its transactions to Other', async () => {
      const user = userEvent.setup();
      localStorage.setItem(
        'mm:categories',
        '[{"id":1000,"kind":"expense","label":"Pets","icon":"dog"}]',
      );
      localStorage.setItem('mm:tx:202611', '[["a1",23,1000,700]]');
      render(<App />, { wrapper: Providers });

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      await user.click(screen.getByRole('button', { name: /^Pets/ }));
      const dialog = screen.getByRole('dialog', { name: 'Edit category' });
      await user.click(
        within(dialog).getByRole('button', { name: 'Delete category' }),
      );

      expect(
        within(dialog).getByText(/Its 1 transaction will move to Other/),
      ).toBeVisible();

      await user.click(
        within(dialog).getByRole('button', { name: 'Delete category' }),
      );

      expect(screen.getByText('Deleted Pets')).toBeVisible();
      expect(localStorage.getItem('mm:categories')).toBeNull();
      expect(localStorage.getItem('mm:tx:202611')).toBe('[["a1",23,9,700]]');
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
