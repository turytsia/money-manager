import * as React from 'react';
import { createPortal } from 'react-dom';
import { css, cx, keyframes } from '@emotion/css';

const TOAST_DURATION = 4500;

const TOAST_IN = keyframes`
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: none;
  }
`;

const styles = {
  // Toasts sit at the top so they never cover the keypad or the Add button.
  container: css`
    position: fixed;
    top: calc(var(--safe-top) + 10px);
    left: 16px;
    right: 16px;
    z-index: 60;
    display: flex;
    justify-content: center;
    pointer-events: none;
  `,
  toast: css`
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 100%;
    min-height: 44px;
    padding: 6px 6px 6px 16px;
    border-radius: 22px;
    background: var(--color-fg);
    color: var(--color-inverse-fg);
    box-shadow: var(--shadow-raised);
    font-size: 14px;
    font-weight: 500;
    pointer-events: auto;
    animation: ${TOAST_IN} 280ms var(--ease-out) both;
  `,
  danger: css`
    background: var(--color-danger);
    color: #ffffff;
  `,
  message: css`
    padding: 4px 10px 4px 0;
  `,
  action: css`
    flex-shrink: 0;
    height: 32px;
    padding: 0 14px;
    border-radius: 16px;
    background: color-mix(in srgb, currentColor 16%, transparent);
    font-size: 13px;
    font-weight: 600;

    &:active {
      background: color-mix(in srgb, currentColor 28%, transparent);
    }
  `,
};

const ToastContext = React.createContext<ShowToast | null>(null);

export enum ToastTone {
  Default = 'default',
  Danger = 'danger',
}

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

export type ShowToast = (options: ToastOptions) => void;

export interface ToastProviderProps {
  children: React.ReactNode;
}

interface ActiveToast extends ToastOptions {
  id: number;
}

interface ToastViewProps {
  toast: ActiveToast;
  onDismiss: () => void;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = React.useState<ActiveToast | null>(null);
  const timer = React.useRef<number | undefined>(undefined);
  const lastId = React.useRef(0);

  // Stable, so showing a toast does not re-render every screen that can.
  const showToast = React.useCallback<ShowToast>((options) => {
    window.clearTimeout(timer.current);
    lastId.current += 1;
    setToast({ ...options, id: lastId.current });
    timer.current = window.setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  const dismiss = (): void => {
    window.clearTimeout(timer.current);
    setToast(null);
  };

  return (
    <ToastContext value={showToast}>
      {children}
      {toast &&
        createPortal(
          <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />,
          document.body,
        )}
    </ToastContext>
  );
};

export function useToast(): ShowToast {
  const showToast = React.useContext(ToastContext);
  if (!showToast) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return showToast;
}

const ToastView: React.FC<ToastViewProps> = ({ toast, onDismiss }) => {
  const handleAction = (): void => {
    toast.onAction?.();
    onDismiss();
  };

  return (
    <div className={styles.container}>
      <div
        role='status'
        className={cx(
          styles.toast,
          toast.tone === ToastTone.Danger && styles.danger,
        )}
      >
        <span className={styles.message}>{toast.message}</span>
        {toast.actionLabel && (
          <button
            type='button'
            className={styles.action}
            onClick={handleAction}
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};
