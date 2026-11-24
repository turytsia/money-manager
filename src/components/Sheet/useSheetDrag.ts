import * as React from 'react';

/** Set on the panel while it is dragged: how far down it is, in pixels. */
export const DRAG_OFFSET_PROPERTY = '--sheet-drag-offset';

/** Set on the backdrop while dragging: 0 when open, 1 when fully down. */
export const DRAG_PROGRESS_PROPERTY = '--sheet-drag-progress';

/** Present on the panel and backdrop while a finger is dragging them. */
export const DRAGGING_ATTRIBUTE = 'data-dragging';

/** A touch has to move this far down before it counts as a drag. */
const DRAG_START_DISTANCE = 4;

/** Letting go below this part of the sheet's height closes it. */
const CLOSE_DISTANCE_RATIO = 0.3;

/** A flick faster than this closes it too, in pixels per millisecond. */
const CLOSE_VELOCITY = 0.5;

/** The speed of a flick is measured over this last stretch of time. */
const VELOCITY_WINDOW = 120;

const SCROLLABLE_OVERFLOWS: ReadonlyArray<string> = ['auto', 'scroll'];

interface Gesture {
  startX: number;
  startY: number;
  /** False when the touch began on content that is scrolled down. */
  canDrag: boolean;
  isDragging: boolean;
  offset: number;
  samples: Array<{ time: number; offset: number }>;
}

/**
 * Lets a sheet be closed by dragging it down, like sheets in iOS.
 *
 * The drag can start anywhere on the sheet. Content that is scrolled down
 * scrolls first; the sheet only starts to move once that content is back
 * at its top. The sheet follows the finger by changing a CSS variable
 * directly, which keeps React out of the way and the movement smooth.
 */
export function useSheetDrag(
  panel: React.RefObject<HTMLElement | null>,
  backdrop: React.RefObject<HTMLElement | null>,
  onDismiss: () => void,
): void {
  const dismiss = React.useEffectEvent(onDismiss);

  React.useEffect(() => {
    const panelElement = panel.current;
    const backdropElement = backdrop.current;
    if (!panelElement) {
      return undefined;
    }
    const elements = backdropElement
      ? [panelElement, backdropElement]
      : [panelElement];
    let gesture: Gesture | null = null;

    const moveTo = (offset: number): void => {
      const progress = Math.min(1, offset / panelElement.offsetHeight);
      panelElement.style.setProperty(DRAG_OFFSET_PROPERTY, `${offset}px`);
      backdropElement?.style.setProperty(
        DRAG_PROGRESS_PROPERTY,
        String(progress),
      );
    };

    const handleTouchStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      gesture =
        event.touches.length === 1
          ? {
              startX: touch.clientX,
              startY: touch.clientY,
              canDrag: isScrolledToTop(event.target, panelElement),
              isDragging: false,
              offset: 0,
              samples: [],
            }
          : null;
    };

    const handleTouchMove = (event: TouchEvent): void => {
      if (!gesture) {
        return;
      }
      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;
      if (!gesture.isDragging) {
        const isDownward = deltaY > 0 && deltaY > Math.abs(deltaX);
        const hasMoved =
          Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= DRAG_START_DISTANCE;
        if (!hasMoved) {
          return;
        }
        // Anything but a downward drag is left to the browser, and so is a
        // touch the browser has already started scrolling with.
        if (!isDownward || !gesture.canDrag || !event.cancelable) {
          gesture = null;
          return;
        }
        gesture.isDragging = true;
        elements.forEach((element) =>
          element.setAttribute(DRAGGING_ATTRIBUTE, 'true'),
        );
      }
      event.preventDefault();
      gesture.offset = Math.max(0, deltaY);
      gesture.samples.push({ time: event.timeStamp, offset: gesture.offset });
      moveTo(gesture.offset);
    };

    const handleTouchEnd = (event: TouchEvent): void => {
      const finished = gesture;
      gesture = null;
      if (!finished?.isDragging) {
        return;
      }
      elements.forEach((element) =>
        element.removeAttribute(DRAGGING_ATTRIBUTE),
      );
      const isFarEnough =
        finished.offset > panelElement.offsetHeight * CLOSE_DISTANCE_RATIO;
      const isFlick = getVelocity(finished, event.timeStamp) > CLOSE_VELOCITY;
      if (event.type === 'touchend' && (isFarEnough || isFlick)) {
        // The sheet stays where it was let go; closing animates from there.
        dismiss();
        return;
      }
      moveTo(0);
    };

    panelElement.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    // Not passive: stopping the page from scrolling needs preventDefault.
    panelElement.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    });
    panelElement.addEventListener('touchend', handleTouchEnd);
    panelElement.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      panelElement.removeEventListener('touchstart', handleTouchStart);
      panelElement.removeEventListener('touchmove', handleTouchMove);
      panelElement.removeEventListener('touchend', handleTouchEnd);
      panelElement.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [panel, backdrop]);
}

/** True when nothing between the touched element and the sheet is scrolled. */
function isScrolledToTop(
  target: EventTarget | null,
  panel: HTMLElement,
): boolean {
  let element = target instanceof Element ? target : null;
  while (element && panel.contains(element)) {
    if (element.scrollTop > 0 && isScrollable(element)) {
      return false;
    }
    element = element.parentElement;
  }
  return true;
}

function isScrollable(element: Element): boolean {
  return SCROLLABLE_OVERFLOWS.includes(getComputedStyle(element).overflowY);
}

/** Downward speed at the end of the drag, in pixels per millisecond. */
function getVelocity(gesture: Gesture, endTime: number): number {
  const recent = gesture.samples.filter(
    ({ time }) => endTime - time <= VELOCITY_WINDOW,
  );
  const first = recent[0];
  const last = recent.at(-1);
  if (!first || !last || last.time === first.time) {
    return 0;
  }
  return (last.offset - first.offset) / (last.time - first.time);
}
