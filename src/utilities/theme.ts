import { injectGlobal } from '@emotion/css';
import geistMonoLatinUrl from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?url';
import geistLatinExtUrl from '@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2?url';
import geistLatinUrl from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url';
import { ThemePreference } from './types';

const LIGHT_BACKGROUND = '#fafafa';
const DARK_BACKGROUND = '#000000';
const DARK_MEDIA_KEYWORD = 'dark';
const THEME_COLOR_SELECTOR = 'meta[name="theme-color"]';

// Only the Latin files are bundled, which keeps the installed app small.
const LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT_RANGE =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

const LIGHT_TOKENS = `
  color-scheme: light;
  --color-bg: ${LIGHT_BACKGROUND};
  --color-surface: #ffffff;
  --color-surface-raised: #f0f0f0;
  --color-border: rgba(0, 0, 0, 0.1);
  --color-border-strong: rgba(0, 0, 0, 0.22);
  --color-fg: #171717;
  --color-fg-secondary: #666666;
  --color-fg-tertiary: #8f8f8f;
  --color-inverse-fg: #ffffff;
  --color-accent: #0068d6;
  --color-danger: #cb2a2f;
  --color-success: #297a3a;
  --color-warning: #a35200;
  --color-chart-muted: #8f8f8f;
  --color-grid-dot: rgba(0, 0, 0, 0.16);
  --color-overlay: rgba(0, 0, 0, 0.4);
  --shadow-raised: 0 8px 30px rgba(0, 0, 0, 0.12);
`;

const DARK_TOKENS = `
  color-scheme: dark;
  --color-bg: ${DARK_BACKGROUND};
  --color-surface: #0a0a0a;
  --color-surface-raised: #1c1c1c;
  --color-border: rgba(255, 255, 255, 0.14);
  --color-border-strong: rgba(255, 255, 255, 0.28);
  --color-fg: #ededed;
  --color-fg-secondary: #a1a1a1;
  --color-fg-tertiary: #7d7d7d;
  --color-inverse-fg: #0a0a0a;
  --color-accent: #52a8ff;
  --color-danger: #ff6166;
  --color-success: #62c073;
  --color-warning: #ffb224;
  --color-chart-muted: #5e5e5e;
  --color-grid-dot: rgba(255, 255, 255, 0.2);
  --color-overlay: rgba(0, 0, 0, 0.66);
  --shadow-raised: 0 8px 30px rgba(0, 0, 0, 0.6);
`;

/** Installs fonts, design tokens and base styles. Call once at startup. */
export function applyGlobalStyles(): void {
  injectGlobal`
    @font-face {
      font-family: 'Geist';
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
      src: url(${geistLatinUrl}) format('woff2-variations');
      unicode-range: ${LATIN_RANGE};
    }

    @font-face {
      font-family: 'Geist';
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
      src: url(${geistLatinExtUrl}) format('woff2-variations');
      unicode-range: ${LATIN_EXT_RANGE};
    }

    @font-face {
      font-family: 'Geist Mono';
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
      src: url(${geistMonoLatinUrl}) format('woff2-variations');
      unicode-range: ${LATIN_RANGE};
    }

    :root {
      ${LIGHT_TOKENS}
      --font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI',
        Roboto, sans-serif;
      --font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
      --radius-s: 8px;
      --radius-m: 12px;
      --radius-l: 16px;
      --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --tab-bar-height: 56px;
      --content-width: 560px;
    }

    @media (prefers-color-scheme: dark) {
      :root:not([data-theme='light']) {
        ${DARK_TOKENS}
      }
    }

    :root[data-theme='dark'] {
      ${DARK_TOKENS}
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    html,
    body,
    #root {
      height: 100%;
    }

    html {
      background: var(--color-bg);
      -webkit-text-size-adjust: 100%;
      touch-action: manipulation;
    }

    body {
      margin: 0;
      overflow: hidden;
      overscroll-behavior: none;
      background: var(--color-bg);
      color: var(--color-fg);
      font-family: var(--font-sans);
      font-size: 16px;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }

    h1,
    h2,
    h3,
    p,
    figure {
      margin: 0;
    }

    h1,
    h2,
    h3 {
      font-size: inherit;
      font-weight: inherit;
    }

    button,
    input,
    select {
      font: inherit;
      color: inherit;
    }

    button {
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-appearance: none;
      appearance: none;
    }

    svg {
      display: block;
      flex-shrink: 0;
    }

    :focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-delay: 0ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `;
}

/** Applies the chosen theme. With "system" the device setting decides. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === ThemePreference.System) {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }
  document
    .querySelectorAll<HTMLMetaElement>(THEME_COLOR_SELECTOR)
    .forEach((meta) => {
      meta.content = getBackground(preference, meta.media);
    });
}

function getBackground(preference: ThemePreference, media: string): string {
  if (preference === ThemePreference.Light) {
    return LIGHT_BACKGROUND;
  }
  if (preference === ThemePreference.Dark) {
    return DARK_BACKGROUND;
  }
  return media.includes(DARK_MEDIA_KEYWORD)
    ? DARK_BACKGROUND
    : LIGHT_BACKGROUND;
}
