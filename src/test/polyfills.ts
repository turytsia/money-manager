import { webcrypto } from 'node:crypto';

// The test browser (jsdom) has no AnimationEvent. Without it React listens
// for a legacy event name, and `fireEvent.animationEnd` would do nothing.
// This must run before React loads, so it has its own setup file.
class AnimationEventPolyfill extends Event implements AnimationEvent {
  readonly animationName: string;
  readonly elapsedTime: number;
  readonly pseudoElement: string;

  constructor(type: string, init: AnimationEventInit = {}) {
    super(type, init);
    this.animationName = init.animationName ?? '';
    this.elapsedTime = init.elapsedTime ?? 0;
    this.pseudoElement = init.pseudoElement ?? '';
  }
}

window.AnimationEvent ??= AnimationEventPolyfill;

// jsdom does no layout, so it has no scrolling either.
Element.prototype.scrollIntoView ??= function scrollIntoView(): void {};

// jsdom has no WebCrypto, which the app uses to hash the sync password.
if (!window.crypto?.subtle) {
  Object.defineProperty(window, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}
