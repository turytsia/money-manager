import * as React from 'react';
import type { SyncEngine, SyncStatus } from '../../utilities/sync/syncEngine';

const SyncEngineContext = React.createContext<SyncEngine | null>(null);

export interface SyncEngineProviderProps {
  engine: SyncEngine;
  children: React.ReactNode;
}

export const SyncEngineProvider: React.FC<SyncEngineProviderProps> = ({
  engine,
  children,
}) => {
  return <SyncEngineContext value={engine}>{children}</SyncEngineContext>;
};

/** Gives access to turning cloud sync on and off. Does not re-render. */
export function useSyncEngine(): SyncEngine {
  const engine = React.useContext(SyncEngineContext);
  if (!engine) {
    throw new Error('useSyncEngine must be used within a SyncEngineProvider');
  }
  return engine;
}

/** What cloud sync is doing. Re-renders when that changes. */
export function useSyncStatus(): SyncStatus {
  const engine = useSyncEngine();
  return React.useSyncExternalStore(engine.subscribe, engine.getStatus);
}
