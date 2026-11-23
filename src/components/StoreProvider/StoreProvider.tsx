import * as React from 'react';
import type { Store } from '../../utilities/store';
import type { Settings, Transaction } from '../../utilities/types';

const StoreContext = React.createContext<Store | null>(null);

export interface StoreProviderProps {
  store: Store;
  children: React.ReactNode;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({
  store,
  children,
}) => {
  return <StoreContext value={store}>{children}</StoreContext>;
};

/** Gives access to the actions that change data. Does not re-render. */
export function useStore(): Store {
  const store = React.useContext(StoreContext);
  if (!store) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return store;
}

/** All transactions, newest first. Re-renders only when they change. */
export function useTransactions(): ReadonlyArray<Transaction> {
  const store = useStore();
  return React.useSyncExternalStore(
    store.subscribe,
    () => store.getState().transactions,
  );
}

export function useSettings(): Settings {
  const store = useStore();
  return React.useSyncExternalStore(
    store.subscribe,
    () => store.getState().settings,
  );
}
