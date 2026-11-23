import * as React from 'react';
import { getToday } from './dates';
import type { DayKey } from './types';

const REFRESH_INTERVAL = 60_000;

/**
 * Today's date, kept current. The app can stay open for days on a phone, so
 * "today" is re-read every minute and whenever the app comes back into view.
 */
export function useToday(): DayKey {
  return React.useSyncExternalStore(subscribeToClock, getToday);
}

function subscribeToClock(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, REFRESH_INTERVAL);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onChange);
  };
}
