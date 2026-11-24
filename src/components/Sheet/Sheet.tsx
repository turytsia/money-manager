import * as React from 'react';
import { createPortal } from 'react-dom';
import { css, cx, keyframes } from '@emotion/css';
import {
  DRAG_OFFSET_PROPERTY,
  DRAG_PROGRESS_PROPERTY,
  DRAGGING_ATTRIBUTE,
  useSheetDrag,
} from './useSheetDrag';

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
    /* Fades as the sheet is dragged down. */
    opacity: calc(1 - var(${DRAG_PROGRESS_PROPERTY}, 0) * 0.7);
    transition: opacity 260ms var(--ease-out);
    animation: ${FADE_IN} 220ms ease-out;

    &[${DRAGGING_ATTRIBUTE}] {
      transition: none;
    }
  `,
  backdropClosing: css`
    animation: ${FADE_OUT} 200ms ease-in forwards;
  `,
  panel: css`
    position: fixed;
    left: 0;
    right: 0;
    /* Set at startup, so the sheet sits above the on-screen keyboard. */
    bottom: var(--keyboard-inset, 0px);
    z-index: 41;
    display: flex;
    flex-direction: column;
    max-width: var(--content-width);
    max-height: calc(var(--visible-height, 100dvh) - var(--safe-top) - 12px);
    margin: 0 auto;
    padding: 8px 16px calc(var(--safe-bottom) + 16px);
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-bottom: 0;
    border-radius: 20px 20px 0 0;
    box-shadow: var(--shadow-raised);
    /* Follows the finger while dragged, and springs back when let go. */
    transform: translateY(var(${DRAG_OFFSET_PROPERTY}, 0px));
    transition: transform 260ms var(--ease-out);
    animation: ${SLIDE_UP} 340ms var(--ease-out);

    &[${DRAGGING_ATTRIBUTE}] {
      transition: none;
    }
  `,
  panelTall: css`
    height: 640px;
  `,
  // Starts from wherever the sheet is, so a drag flows into the close.
  panelClosing: css`
    animation: ${SLIDE_DOWN} 220ms ease-in forwards;
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

const DIALOG_SELECTOR = '[role="dialog"]';

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
 * A panel that slides up from the bottom. It closes by dragging it down,
 * tapping outside it, or pressing Escape. The parent keeps it mounted until
 * `onClose` fires, which lets the sheet animate out before it is removed.
 */
export const Sheet: React.FC<SheetProps> = ({
  title,
  isTall = false,
  onClose,
  children,
}) => {
  const [isClosing, setIsClosing] = React.useState(false);
  const panel = React.useRef<HTMLDivElement>(null);
  const backdrop = React.useRef<HTMLDivElement>(null);
  const requestClose = React.useCallback(() => setIsClosing(true), []);

  useSheetDrag(panel, backdrop, requestClose);

  React.useEffect(() => {
    // With sheets stacked, Escape closes only the top one.
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !isCoveredBySheet(panel.current)) {
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
        ref={backdrop}
        className={cx(styles.backdrop, isClosing && styles.backdropClosing)}
        onClick={requestClose}
      />
      <div
        ref={panel}
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

/** True when an open sheet is on top of the given element. */
export function isCoveredBySheet(element: Element | null): boolean {
  const dialogs = document.querySelectorAll(DIALOG_SELECTOR);
  const topDialog = dialogs.item(dialogs.length - 1);
  return topDialog !== null && !topDialog.contains(element);
}
