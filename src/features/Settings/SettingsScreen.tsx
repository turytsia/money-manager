import * as React from 'react';
import { css } from '@emotion/css';
import { ChevronsUpDown, Monitor, Moon, Sun } from 'lucide-react';
import { ScreenHeader } from '../../components/ScreenHeader/ScreenHeader';
import {
  SegmentedControl,
  type SegmentedOption,
} from '../../components/SegmentedControl/SegmentedControl';
import {
  useSettings,
  useStore,
} from '../../components/StoreProvider/StoreProvider';
import { CURRENCIES } from '../../utilities/money';
import { SCREEN_STYLE } from '../../utilities/styles';
import { ThemePreference } from '../../utilities/types';
import { BackupSection } from './BackupSection';
import { EraseSection } from './EraseSection';
import { SettingsSection } from './SettingsSection';
import { StorageMeter } from './StorageMeter';

const THEME_OPTIONS: ReadonlyArray<SegmentedOption<ThemePreference>> = [
  { value: ThemePreference.System, label: 'System', icon: Monitor },
  { value: ThemePreference.Light, label: 'Light', icon: Sun },
  { value: ThemePreference.Dark, label: 'Dark', icon: Moon },
];

/** True when the app was opened from the Home Screen, not in a browser tab. */
const IS_INSTALLED =
  navigator.standalone === true ||
  (typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches);

const styles = {
  field: css`
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;
  `,
  selectWrapper: css`
    position: relative;
    display: flex;
    align-items: center;
    color: var(--color-fg-secondary);
  `,
  // 16px text stops iOS from zooming the page in when the field is focused.
  select: css`
    max-width: 172px;
    height: 36px;
    padding: 0 30px 0 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-s);
    background: var(--color-bg);
    color: var(--color-fg);
    font-size: 16px;
    text-overflow: ellipsis;
    -webkit-appearance: none;
    appearance: none;
  `,
  selectIcon: css`
    position: absolute;
    right: 9px;
    pointer-events: none;
  `,
  note: css`
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
  footer: css`
    margin-top: 8px;
    color: var(--color-fg-tertiary);
    font-family: var(--font-mono);
    font-size: 11px;
    text-align: center;
  `,
};

export const SettingsScreen: React.FC = () => {
  const store = useStore();
  const { theme, currency } = useSettings();

  return (
    <section aria-label='Settings' className={SCREEN_STYLE}>
      <ScreenHeader title='Settings' />
      <SettingsSection title='Appearance'>
        <SegmentedControl
          label='Theme'
          options={THEME_OPTIONS}
          value={theme}
          onChange={(nextTheme) => store.updateSettings({ theme: nextTheme })}
        />
      </SettingsSection>
      <SettingsSection title='Currency'>
        <label className={styles.field}>
          Show amounts in
          <span className={styles.selectWrapper}>
            <select
              className={styles.select}
              value={currency}
              onChange={(event) =>
                store.updateSettings({ currency: event.target.value })
              }
            >
              {CURRENCIES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {code} · {label}
                </option>
              ))}
            </select>
            <ChevronsUpDown
              size={14}
              aria-hidden='true'
              className={styles.selectIcon}
            />
          </span>
        </label>
        <p className={styles.note}>
          This only changes the symbol. Amounts are not converted.
        </p>
      </SettingsSection>
      <SettingsSection title='Storage'>
        <StorageMeter />
      </SettingsSection>
      <BackupSection />
      {!IS_INSTALLED && (
        <SettingsSection title='Install on iPhone'>
          <p className={styles.note}>
            Open this page in Safari, tap the Share button, then choose Add to
            Home Screen. The app then opens full screen and works offline.
          </p>
        </SettingsSection>
      )}
      <EraseSection />
      <p className={styles.footer}>Money Manager {__APP_VERSION__}</p>
    </section>
  );
};
