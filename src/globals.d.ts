/** The version from package.json, set at build time. */
declare const __APP_VERSION__: string;

interface Navigator {
  /** Set by iOS Safari when the app runs from the Home Screen. */
  readonly standalone?: boolean;
}
