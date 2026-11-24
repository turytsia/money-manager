import * as React from 'react';
import { StoreProvider } from '../components/StoreProvider/StoreProvider';
import { SyncEngineProvider } from '../components/SyncEngineProvider/SyncEngineProvider';
import { ToastProvider } from '../components/ToastProvider/ToastProvider';
import { createStore } from '../utilities/store';
import { createSyncEngine } from '../utilities/sync/syncEngine';
import { createMemoryCloud, type MemoryCloud } from './mocks/memoryCloud';

export interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Makes a wrapper with the same providers the app uses. The store reads
 * whatever the test has put in local storage beforehand, and cloud sync
 * talks to the given in-memory cloud instead of a server.
 */
export function createProviders(
  cloud: MemoryCloud = createMemoryCloud(),
): React.FC<ProvidersProps> {
  return function TestProviders({ children }) {
    const [store] = React.useState(createStore);
    const [engine] = React.useState(() =>
      createSyncEngine(store, cloud.createProvider),
    );

    return (
      <StoreProvider store={store}>
        <SyncEngineProvider engine={engine}>
          <ToastProvider>{children}</ToastProvider>
        </SyncEngineProvider>
      </StoreProvider>
    );
  };
}

/** The providers with a cloud of their own, for tests that do not sync. */
export const Providers = createProviders();
