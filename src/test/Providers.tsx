import * as React from 'react';
import { StoreProvider } from '../components/StoreProvider/StoreProvider';
import { ToastProvider } from '../components/ToastProvider/ToastProvider';
import { createStore } from '../utilities/store';

export interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Wraps a component in the same providers the app uses. The store reads
 * whatever the test has put in local storage beforehand.
 */
export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  const [store] = React.useState(createStore);

  return (
    <StoreProvider store={store}>
      <ToastProvider>{children}</ToastProvider>
    </StoreProvider>
  );
};
