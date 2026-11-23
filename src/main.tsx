import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './components/StoreProvider/StoreProvider';
import { ToastProvider } from './components/ToastProvider/ToastProvider';
import { registerServiceWorker } from './utilities/serviceWorker';
import { createStore } from './utilities/store';
import { applyGlobalStyles } from './utilities/theme';

const ROOT_ELEMENT_ID = 'root';

function startApp(): void {
  const rootElement = document.getElementById(ROOT_ELEMENT_ID);
  if (!rootElement) {
    throw new Error(`Element #${ROOT_ELEMENT_ID} is missing from the page`);
  }
  applyGlobalStyles();
  enablePressedStates();
  protectSavedData();
  registerServiceWorker();

  createRoot(rootElement).render(
    <React.StrictMode>
      <StoreProvider store={createStore()}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </StoreProvider>
    </React.StrictMode>,
  );
}

/** iOS only shows pressed (`:active`) styles once a touch listener exists. */
function enablePressedStates(): void {
  document.addEventListener('touchstart', () => undefined, { passive: true });
}

/** Asks the browser not to clear saved data when the device runs low. */
function protectSavedData(): void {
  navigator.storage?.persist?.().catch(() => undefined);
}

startApp();
