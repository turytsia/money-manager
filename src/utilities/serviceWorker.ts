const SERVICE_WORKER_URL = `${import.meta.env.BASE_URL}sw.js`;

/**
 * Makes the app work offline. Updates are picked up quietly: a new version
 * downloads in the background and is swapped in the next time the app is
 * put in the background, so the user is never interrupted mid-entry.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }
  const { serviceWorker } = navigator;
  const isUpdate = serviceWorker.controller !== null;
  let registration: ServiceWorkerRegistration | undefined;
  let isNewVersionReady = false;

  serviceWorker.addEventListener('controllerchange', () => {
    // The very first install also changes the controller; that needs no reload.
    isNewVersionReady = isUpdate;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isNewVersionReady) {
      window.location.reload();
      return;
    }
    if (!document.hidden) {
      registration?.update().catch(ignoreOfflineError);
    }
  });

  window.addEventListener('load', () => {
    serviceWorker
      .register(SERVICE_WORKER_URL, { updateViaCache: 'none' })
      .then((result) => {
        registration = result;
      })
      .catch((error: unknown) => {
        console.warn('Offline mode is not available', error);
      });
  });
}

function ignoreOfflineError(): void {
  // Checking for an update fails while offline. The next check will retry.
}
