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
