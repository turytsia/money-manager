import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './components/StoreProvider/StoreProvider';
import { SyncEngineProvider } from './components/SyncEngineProvider/SyncEngineProvider';
import { ToastProvider } from './components/ToastProvider/ToastProvider';
import { registerServiceWorker } from './utilities/serviceWorker';
import { createStore } from './utilities/store';
import { createHttpSyncProvider } from './utilities/sync/httpSyncProvider';
import { createSyncEngine } from './utilities/sync/syncEngine';
import { applyGlobalStyles } from './utilities/theme';

const ROOT_ELEMENT_ID = 'root';

/** Relative, so it works wherever the app is hosted. */
const SYNC_ENDPOINT = `${import.meta.env.BASE_URL}api/sync`;
const KEYBOARD_INSET_PROPERTY = '--keyboard-inset';
const VISIBLE_HEIGHT_PROPERTY = '--visible-height';

function startApp(): void {
  const rootElement = document.getElementById(ROOT_ELEMENT_ID);
  if (!rootElement) {
    throw new Error(`Element #${ROOT_ELEMENT_ID} is missing from the page`);
  }
  applyGlobalStyles();
  enablePressedStates();
  trackOnScreenKeyboard();
  protectSavedData();
  registerServiceWorker();

  const store = createStore();
  // This is the one place that picks where cloud sync talks to. Another
  // service only needs another provider here.
  const syncEngine = createSyncEngine(store, (token) =>
    createHttpSyncProvider(SYNC_ENDPOINT, token),
  );
  syncEngine.start();

  createRoot(rootElement).render(
    <React.StrictMode>
      <StoreProvider store={store}>
        <SyncEngineProvider engine={syncEngine}>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SyncEngineProvider>
      </StoreProvider>
    </React.StrictMode>,
  );
}

/** iOS only shows pressed (`:active`) styles once a touch listener exists. */
function enablePressedStates(): void {
  document.addEventListener('touchstart', () => undefined, { passive: true });
}

/**
 * iOS draws the on-screen keyboard over the page instead of resizing it.
 * Its height is shared as CSS variables, so sheets can sit above it.
 */
function trackOnScreenKeyboard(): void {
  const viewport = window.visualViewport;
  if (!viewport) {
    return;
  }
  const update = (): void => {
    // While zoomed in the visible area also shrinks; that is not a keyboard.
    const inset =
      viewport.scale > 1
        ? 0
        : Math.max(
            0,
            window.innerHeight - viewport.height - viewport.offsetTop,
          );
    const { style } = document.documentElement;
    style.setProperty(KEYBOARD_INSET_PROPERTY, `${Math.round(inset)}px`);
    style.setProperty(VISIBLE_HEIGHT_PROPERTY, `${viewport.height}px`);
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  update();
}

/** Asks the browser not to clear saved data when the device runs low. */
function protectSavedData(): void {
  navigator.storage?.persist?.().catch(() => undefined);
}

startApp();
