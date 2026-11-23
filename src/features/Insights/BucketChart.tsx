import * as React from 'react';
import { css, cx, keyframes } from '@emotion/css';
import { formatMoney, formatMoneyCompact } from '../../utilities/money';
import { VISUALLY_HIDDEN_STYLE } from '../../utilities/styles';
import type { DayKey } from '../../utilities/types';
import type { ChartBar } from './insights';

const PLOT_TOP = 8;
const PLOT_HEIGHT = 136;
const AXIS_HEIGHT = 24;
const CHART_HEIGHT = PLOT_TOP + PLOT_HEIGHT + AXIS_HEIGHT;
const TICK_BASELINE = CHART_HEIGHT - 6;
const BAR_RADIUS = 4;
const MIN_BAR_HEIGHT = 2;
const PERCENT = 100;

/** Gridlines at the top, middle and bottom of the scale. */
const GRID_RATIOS = [1, 0.5, 0] as const;

// Bars get thinner as more of them share the width, and never thicker than
// 24px so they stay bars rather than blocks on wide screens.
const BAR_WIDTHS = [
  { maxBarCount: 6, width: 24 },
  { maxBarCount: 12, width: 16 },
  { maxBarCount: Infinity, width: 12 },
] as const;

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
  bar: css`
    fill: var(--color-chart-muted);
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: ${GROW} 480ms var(--ease-out) backwards;
    transition:
      fill 150ms ease,
      y 300ms var(--ease-out),
      height 300ms var(--ease-out);
  `,
  barSelected: css`
    fill: var(--color-fg);
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
  scaleMax: number;
  selectedStart: DayKey;
  currency: string;
  onSelect: (start: DayKey) => void;
}

interface ChartSlotProps {
  bar: ChartBar;
  position: number;
  slotWidth: number;
  barWidth: number;
  barHeight: number;
  isSelected: boolean;
  onSelect: (start: DayKey) => void;
}

/**
 * A bar per period, with the selected one highlighted. Tapping a bar
 * selects it. Everything is sized with SVG attributes in percent, so the
 * chart fits any width without measuring the screen.
 */
export const BucketChart: React.FC<BucketChartProps> = ({
  title,
  bars,
  scaleMax,
  selectedStart,
  currency,
  onSelect,
}) => {
  const slotWidth = PERCENT / bars.length;
  const barWidth = getBarWidth(bars.length);

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
            position={position}
            slotWidth={slotWidth}
            barWidth={barWidth}
            barHeight={getBarHeight(bar.amount, scaleMax)}
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
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.start}>
              <th scope='row'>{bar.label}</th>
              <td>{formatMoney(bar.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

const ChartSlot: React.FC<ChartSlotProps> = ({
  bar,
  position,
  slotWidth,
  barWidth,
  barHeight,
  isSelected,
  onSelect,
}) => {
  return (
    <svg
      x={`${position * slotWidth}%`}
      width={`${slotWidth}%`}
      height={CHART_HEIGHT}
      className={styles.slot}
      onClick={() => onSelect(bar.start)}
    >
      {/* This inner viewport ends at the baseline and clips what is below
          it. The bar is drawn a little too tall, so only its top corners
          show as rounded and it meets the baseline with a square edge. */}
      <svg y={PLOT_TOP} width='100%' height={PLOT_HEIGHT}>
        {barHeight > 0 && (
          <g transform={`translate(${-barWidth / 2} 0)`}>
            <rect
              className={cx(styles.bar, isSelected && styles.barSelected)}
              x='50%'
              y={PLOT_HEIGHT - barHeight}
              width={barWidth}
              height={barHeight + BAR_RADIUS}
              rx={BAR_RADIUS}
            />
          </g>
        )}
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

function getBarWidth(barCount: number): number {
  const match = BAR_WIDTHS.find(({ maxBarCount }) => barCount <= maxBarCount);
  return match?.width ?? BAR_WIDTHS[0].width;
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
