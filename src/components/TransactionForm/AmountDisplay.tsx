import * as React from 'react';
import { css, cx, keyframes } from '@emotion/css';
import { formatAmountText } from '../../utilities/amountInput';

// Longer amounts step down in size so they always fit on one line.
const MEDIUM_SIZE_LENGTH = 7;
const SMALL_SIZE_LENGTH = 10;

const DIGIT_IN = keyframes`
  from {
    opacity: 0;
    transform: translateY(0.16em) scale(0.92);
  }
`;

const CARET_BLINK = keyframes`
  50% {
    opacity: 0;
  }
`;

const FADE_IN = keyframes`
  from {
    opacity: 0;
  }
`;

const styles = {
  root: css`
    position: relative;
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 92px;
    animation: ${FADE_IN} 240ms ease-out;

    @media (max-height: 700px) {
      min-height: 76px;
    }

    /* A faint dot grid that fades out toward the edges. */
    &::before {
      content: '';
      position: absolute;
      inset: -8px -16px;
      background-image: radial-gradient(
        circle,
        var(--color-grid-dot) 1px,
        transparent 1px
      );
      background-position: center;
      background-size: 18px 18px;
      -webkit-mask-image: radial-gradient(
        ellipse 62% 70% at center,
        #000 10%,
        transparent 72%
      );
      mask-image: radial-gradient(
        ellipse 62% 70% at center,
        #000 10%,
        transparent 72%
      );
      pointer-events: none;
    }
  `,
  amount: css`
    position: relative;
    display: flex;
    align-items: center;
    font-size: clamp(48px, 15vw, 64px);
    font-weight: 600;
    line-height: 1;
    letter-spacing: -0.05em;

    @media (max-height: 700px) {
      font-size: clamp(40px, 12vw, 48px);
    }
  `,
  amountMedium: css`
    font-size: clamp(40px, 12vw, 52px);

    @media (max-height: 700px) {
      font-size: clamp(34px, 10vw, 42px);
    }
  `,
  amountSmall: css`
    font-size: clamp(30px, 9vw, 40px);

    @media (max-height: 700px) {
      font-size: clamp(28px, 8.4vw, 36px);
    }
  `,
  amountEmpty: css`
    color: var(--color-fg-tertiary);
  `,
  symbol: css`
    margin-right: 0.14em;
    color: var(--color-fg-secondary);
    font-size: 0.5em;
    font-weight: 500;
    letter-spacing: 0;
  `,
  digit: css`
    display: inline-block;
    animation: ${DIGIT_IN} 180ms var(--ease-out);
  `,
  caret: css`
    width: 2px;
    height: 0.78em;
    margin-left: 0.08em;
    border-radius: 1px;
    background: var(--color-accent);
    animation: ${CARET_BLINK} 1.1s steps(1) infinite;
  `,
  caption: css`
    position: relative;
    min-height: 18px;
    color: var(--color-fg-secondary);
    font-size: 13px;
  `,
};

export interface AmountDisplayProps {
  /** The amount as typed, for example "12.5". Empty when nothing is typed. */
  text: string;
  symbol: string;
  caption?: React.ReactNode;
}

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  text,
  symbol,
  caption,
}) => {
  const formatted = formatAmountText(text);

  return (
    <div className={styles.root}>
      <output
        aria-label='Amount'
        className={cx(
          styles.amount,
          formatted.length >= MEDIUM_SIZE_LENGTH && styles.amountMedium,
          formatted.length >= SMALL_SIZE_LENGTH && styles.amountSmall,
          text === '' && styles.amountEmpty,
        )}
      >
        <span className={styles.symbol}>{symbol}</span>
        {[...formatted].map((character, index) => (
          <span key={index} className={styles.digit}>
            {character}
          </span>
        ))}
        <span className={styles.caret} aria-hidden='true' />
      </output>
      <div className={styles.caption}>{caption}</div>
    </div>
  );
};
