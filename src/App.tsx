import * as React from 'react';
import { css } from '@emotion/css';
import { useSettings } from './components/StoreProvider/StoreProvider';
import { TabBar } from './components/TabBar/TabBar';
import { ActivityScreen } from './features/Activity/ActivityScreen';
import { EntryScreen } from './features/Entry/EntryScreen';
import { InsightsScreen } from './features/Insights/InsightsScreen';
import { SettingsScreen } from './features/Settings/SettingsScreen';
import { applyTheme } from './utilities/theme';
import { Tab } from './utilities/types';

const SCREENS: ReadonlyArray<ScreenDefinition> = [
  { tab: Tab.Add, Screen: EntryScreen },
  { tab: Tab.Activity, Screen: ActivityScreen },
  { tab: Tab.Insights, Screen: InsightsScreen },
  { tab: Tab.Settings, Screen: SettingsScreen },
];

const styles = {
  root: css`
    position: relative;
    max-width: var(--content-width);
    height: 100%;
    margin: 0 auto;
    overflow: hidden;
    background: var(--color-bg);

    @media (min-width: 600px) {
      border-inline: 1px solid var(--color-border);
    }
  `,
  // An installed iPhone app draws under the status bar, whose text is always
  // white. This strip keeps that text readable in the light theme as well.
  statusBar: css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    height: var(--safe-top);
    background: #000000;
  `,
};

interface ScreenDefinition {
  tab: Tab;
  Screen: React.FC;
}

export const App: React.FC = () => {
  const [selectedTab, setSelectedTab] = React.useState(Tab.Add);
  const { theme } = useSettings();

  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className={styles.root}>
      <div className={styles.statusBar} />
      <main>
        {/* Hidden screens stay mounted, so switching tabs is instant and
            keeps things like a half-typed amount or the scroll position. */}
        {SCREENS.map(({ tab, Screen }) => (
          <React.Activity
            key={tab}
            mode={tab === selectedTab ? 'visible' : 'hidden'}
          >
            <Screen />
          </React.Activity>
        ))}
      </main>
      <TabBar selectedTab={selectedTab} onSelect={setSelectedTab} />
    </div>
  );
};
