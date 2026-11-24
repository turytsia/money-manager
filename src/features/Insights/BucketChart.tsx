import * as React from 'react';
import { css, cx, keyframes } from '@emotion/css';
import { formatMoney, formatMoneyCompact } from '../../utilities/money';
import { VISUALLY_HIDDEN_STYLE } from '../../utilities/styles';
import { TransactionKind, type DayKey } from '../../utilities/types';
import type { ChartBar } from './insights';

const PLOT_TOP = 8;
const PLOT_HEIGHT = 136;
const AXIS_HEIGHT = 24;
const CHART_HEIGHT = PLOT_TOP + PLOT_HEIGHT + AXIS_HEIGHT;
const TICK_BASELINE = CHART_HEIGHT - 6;
const MAX_BAR_RADIUS = 4;
const MIN_BAR_HEIGHT = 2;
const PERCENT = 100;

/** Space between the two bars of one period, in the chart's own color. */
const BAR_GAP = 2;

/** Gridlines at the top, middle and bottom of the scale. */
const GRID_RATIOS = [1, 0.5, 0] as const;

// Bars get thinner as more of them share the width, and never thicker than
// 24px so they stay bars rather than blocks on wide screens. Paired bars are
// thin enough to leave more room between periods than between the two bars
// of one period, even on the narrowest iPhone.
const BAR_WIDTHS = [
  { maxPeriodCount: 6, single: 24, paired: 16 },
  { maxPeriodCount: 12, single: 16, paired: 7 },
  { maxPeriodCount: Infinity, single: 12, paired: 5 },
] as const;

export const SERIES_LABELS: Readonly<Record<TransactionKind, string>> = {
  [TransactionKind.Income]: 'Earned',
  [TransactionKind.Expense]: 'Spent',
};

const GROW = keyframes`
  from {
    transform: scaleY(0);
  }
`;

const styles = {
  root: css`
    display: flex;
    gap: 8px;
  `,
  plot: css`
    flex: 1;
    min-width: 0;
  `,
  gridline: css`
    stroke: var(--color-border);
    stroke-width: 1;
  `,
  slot: css`
    cursor: pointer;
  `,
  // Marks the selected period without changing the color of its bars, so a
  // color always means the same series.
  selection: css`
    fill: var(--color-surface-raised);
  `,
  bar: css`
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: ${GROW} 480ms var(--ease-out) backwards;
    transition:
      y 300ms var(--ease-out),
      height 300ms var(--ease-out);
  `,
  // The two series colors were checked to stay apart for color-blind
  // viewers and to stand out from the card in both themes.
  [TransactionKind.Income]: css`
    fill: var(--color-series-earned);
  `,
  [TransactionKind.Expense]: css`
    fill: var(--color-series-spent);
  `,
  tick: css`
    fill: var(--color-fg-tertiary);
    font-family: var(--font-mono);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  `,
  tickSelected: css`
    fill: var(--color-fg);
    font-weight: 600;
  `,
  hitArea: css`
    fill: transparent;
  `,
  // Scale labels sit beside the plot, centered on their gridlines.
  scale: css`
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: ${PLOT_HEIGHT + 12}px;
    margin-top: ${PLOT_TOP - 6}px;
    color: var(--color-fg-tertiary);
    font-family: var(--font-mono);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
    line-height: 12px;
    text-align: right;
  `,
};

export interface BucketChartProps {
  /** Says what the chart shows, for screen readers. */
  title: string;
  bars: ReadonlyArray<ChartBar>;
  /** The series to draw, in order. One bar per series in every period. */
  kinds: ReadonlyArray<TransactionKind>;
  scaleMax: number;
  selectedStart: DayKey;
  currency: string;
  onSelect: (start: DayKey) => void;
}

interface ChartSlotProps {
  bar: ChartBar;
  kinds: ReadonlyArray<TransactionKind>;
  position: number;
  slotWidth: number;
  barWidth: number;
  scaleMax: number;
  isSelected: boolean;
  onSelect: (start: DayKey) => void;
}

/**
 * What was earned and spent in each period, as two bars side by side.
 * Tapping a period selects it. Everything is sized with SVG attributes in
 * percent, so the chart fits any width without measuring the screen.
 */
export const BucketChart: React.FC<BucketChartProps> = ({
  title,
  bars,
  kinds,
  scaleMax,
  selectedStart,
  currency,
  onSelect,
}) => {
  const slotWidth = PERCENT / bars.length;
  const barWidth = getBarWidth(bars.length, kinds.length);

  return (
    <figure className={styles.root}>
      <svg
        role='img'
        aria-label={title}
        width='100%'
        height={CHART_HEIGHT}
        className={styles.plot}
      >
        {GRID_RATIOS.map((ratio) => (
          <line
            key={ratio}
            className={styles.gridline}
            x1='0'
            x2='100%'
            y1={getGridlineY(ratio)}
            y2={getGridlineY(ratio)}
          />
        ))}
        {bars.map((bar, position) => (
          <ChartSlot
            key={bar.start}
            bar={bar}
            kinds={kinds}
            position={position}
            slotWidth={slotWidth}
            barWidth={barWidth}
            scaleMax={scaleMax}
            isSelected={bar.start === selectedStart}
            onSelect={onSelect}
          />
        ))}
      </svg>
      <div className={styles.scale} aria-hidden='true'>
        <span>{formatMoneyCompact(scaleMax, currency)}</span>
        <span>{formatMoneyCompact(scaleMax / 2, currency)}</span>
        <span>0</span>
      </div>
      <table className={VISUALLY_HIDDEN_STYLE}>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope='col'>Period</th>
            {kinds.map((kind) => (
              <th key={kind} scope='col'>
                {SERIES_LABELS[kind]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.start}>
              <th scope='row'>{bar.label}</th>
              {kinds.map((kind) => (
                <td key={kind}>{formatMoney(bar.amounts[kind], currency)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

const ChartSlot: React.FC<ChartSlotProps> = ({
  bar,
  kinds,
  position,
  slotWidth,
  barWidth,
  scaleMax,
  isSelected,
  onSelect,
}) => {
  const groupWidth = kinds.length * barWidth + (kinds.length - 1) * BAR_GAP;
  const radius = Math.min(MAX_BAR_RADIUS, barWidth / 2);

  return (
    <svg
      x={`${position * slotWidth}%`}
      width={`${slotWidth}%`}
      height={CHART_HEIGHT}
      className={styles.slot}
      onClick={() => onSelect(bar.start)}
    >
      {isSelected && (
        <rect
          className={styles.selection}
          x='6%'
          width='88%'
          height={CHART_HEIGHT}
          rx={6}
        />
      )}
      {/* This inner viewport ends at the baseline and clips what is below
          it. Bars are drawn a little too tall, so only their top corners
          show as rounded and they meet the baseline with a square edge. */}
      <svg y={PLOT_TOP} width='100%' height={PLOT_HEIGHT}>
        {kinds.map((kind, seriesIndex) => {
          const height = getBarHeight(bar.amounts[kind], scaleMax);
          const offset = seriesIndex * (barWidth + BAR_GAP) - groupWidth / 2;
          return (
            height > 0 && (
              <g key={kind} transform={`translate(${offset} 0)`}>
                <rect
                  className={cx(styles.bar, styles[kind])}
                  x='50%'
                  y={PLOT_HEIGHT - height}
                  width={barWidth}
                  height={height + radius}
                  rx={radius}
                />
              </g>
            )
          );
        })}
      </svg>
      <text
        className={cx(styles.tick, isSelected && styles.tickSelected)}
        x='50%'
        y={TICK_BASELINE}
        textAnchor='middle'
      >
        {bar.tick}
      </text>
      <rect className={styles.hitArea} width='100%' height='100%' />
    </svg>
  );
};

function getBarWidth(periodCount: number, seriesCount: number): number {
  const match =
    BAR_WIDTHS.find(({ maxPeriodCount }) => periodCount <= maxPeriodCount) ??
    BAR_WIDTHS[0];
  return seriesCount > 1 ? match.paired : match.single;
}

function getBarHeight(amount: number, scaleMax: number): number {
  if (amount <= 0) {
    return 0;
  }
  return Math.max(MIN_BAR_HEIGHT, (amount / scaleMax) * PLOT_HEIGHT);
}

// Half a pixel keeps one-pixel lines crisp instead of blurred over two rows.
function getGridlineY(ratio: number): number {
  return PLOT_TOP + Math.round(PLOT_HEIGHT * (1 - ratio)) - 0.5;
}
