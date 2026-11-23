import * as React from 'react';
import { createPortal } from 'react-dom';
import { css, cx, keyframes } from '@emotion/css';

const FADE_IN = keyframes`
  from {
    opacity: 0;
  }
`;

const FADE_OUT = keyframes`
  to {
    opacity: 0;
  }
`;

const SLIDE_UP = keyframes`
  from {
    transform: translateY(100%);
  }
`;

const SLIDE_DOWN = keyframes`
  to {
    transform: translateY(100%);
  }
`;

const styles = {
  backdrop: css`
    position: fixed;
    inset: 0;
    z-index: 40;
    background: var(--color-overlay);
    animation: ${FADE_IN} 220ms ease-out both;
  `,
  backdropClosing: css`
    animation: ${FADE_OUT} 200ms ease-in both;
  `,
  panel: css`
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 41;
    display: flex;
    flex-direction: column;
    max-width: var(--content-width);
    max-height: calc(100dvh - var(--safe-top) - 12px);
    margin: 0 auto;
    padding: 8px 16px calc(var(--safe-bottom) + 16px);
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-bottom: 0;
    border-radius: 20px 20px 0 0;
    box-shadow: var(--shadow-raised);
    animation: ${SLIDE_UP} 340ms var(--ease-out) both;
  `,
  panelTall: css`
    height: 720px;
  `,
  panelClosing: css`
    animation: ${SLIDE_DOWN} 220ms ease-in both;
  `,
  grabber: css`
    flex-shrink: 0;
    width: 36px;
    height: 4px;
    margin: 0 auto 12px;
    border-radius: 2px;
    background: var(--color-border-strong);
  `,
};

const SheetContext = React.createContext<(() => void) | null>(null);

export interface SheetProps {
  /** Read out by screen readers as the name of the dialog. */
  title: string;
  /** Fills most of the screen instead of fitting its content. */
  isTall?: boolean;
  /** Called after the closing animation has finished. */
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * A panel that slides up from the bottom. The parent keeps it mounted until
 * `onClose` fires, which lets the sheet animate out before it is removed.
 */
export const Sheet: React.FC<SheetProps> = ({
  title,
  isTall = false,
  onClose,
  children,
}) => {
  const [isClosing, setIsClosing] = React.useState(false);
  const requestClose = React.useCallback(() => setIsClosing(true), []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestClose]);

  const handleAnimationEnd = (event: React.AnimationEvent): void => {
    if (isClosing && event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <SheetContext value={requestClose}>
      <div
        className={cx(styles.backdrop, isClosing && styles.backdropClosing)}
        onClick={requestClose}
      />
      <div
        role='dialog'
        aria-modal='true'
        aria-label={title}
        className={cx(
          styles.panel,
          isTall && styles.panelTall,
          isClosing && styles.panelClosing,
        )}
        onAnimationEnd={handleAnimationEnd}
      >
        <div className={styles.grabber} />
        {children}
      </div>
    </SheetContext>,
    document.body,
  );
};

/** Closes the sheet this component is in, with its closing animation. */
export function useSheetClose(): () => void {
  const requestClose = React.useContext(SheetContext);
  if (!requestClose) {
    throw new Error('useSheetClose must be used within a Sheet');
  }
  return requestClose;
}
