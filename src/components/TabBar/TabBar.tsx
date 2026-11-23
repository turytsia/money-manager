import * as React from 'react';
import { css, cx } from '@emotion/css';
import {
  ChartColumn,
  Plus,
  ReceiptText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { Tab } from '../../utilities/types';

const ICON_SIZE = 22;

const TABS: ReadonlyArray<TabDefinition> = [
  { tab: Tab.Add, label: 'Add', icon: Plus },
  { tab: Tab.Activity, label: 'Activity', icon: ReceiptText },
  { tab: Tab.Insights, label: 'Insights', icon: ChartColumn },
  { tab: Tab.Settings, label: 'Settings', icon: Settings },
];

const styles = {
  root: css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(${TABS.length}, 1fr);
    height: calc(var(--tab-bar-height) + var(--safe-bottom));
    padding-bottom: var(--safe-bottom);
    border-top: 1px solid var(--color-border);
    background: color-mix(in srgb, var(--color-bg) 76%, transparent);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
  `,
  tab: css`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: var(--color-fg-tertiary);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.01em;
    transition: color 150ms ease;

    &::before {
      content: '';
      position: absolute;
      top: -1px;
      left: 50%;
      width: 28px;
      height: 2px;
      border-radius: 0 0 2px 2px;
      background: var(--color-fg);
      opacity: 0;
      transform: translateX(-50%) scaleX(0.4);
      transition:
        opacity 200ms ease,
        transform 200ms var(--ease-out);
    }

    &:active {
      color: var(--color-fg-secondary);
    }
  `,
  tabSelected: css`
    color: var(--color-fg);

    &::before {
      opacity: 1;
      transform: translateX(-50%);
    }
  `,
};

export interface TabBarProps {
  selectedTab: Tab;
  onSelect: (tab: Tab) => void;
}

interface TabDefinition {
  tab: Tab;
  label: string;
  icon: LucideIcon;
}

export const TabBar: React.FC<TabBarProps> = ({ selectedTab, onSelect }) => {
  return (
    <nav aria-label='Main' className={styles.root}>
      {TABS.map(({ tab, label, icon: Icon }) => (
        <button
          key={tab}
          type='button'
          aria-current={tab === selectedTab ? 'page' : undefined}
          className={cx(styles.tab, tab === selectedTab && styles.tabSelected)}
          onClick={() => onSelect(tab)}
        >
          <Icon size={ICON_SIZE} strokeWidth={1.75} aria-hidden='true' />
          {label}
        </button>
      ))}
    </nav>
  );
};
