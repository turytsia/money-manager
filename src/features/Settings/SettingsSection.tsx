import * as React from 'react';
import { css, cx } from '@emotion/css';
import { CARD_STYLE, LABEL_STYLE } from '../../utilities/styles';

const styles = {
  root: css`
    margin-bottom: 24px;
  `,
  title: cx(
    LABEL_STYLE,
    css`
      margin: 0 4px 8px;
    `,
  ),
  card: cx(
    CARD_STYLE,
    css`
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
    `,
  ),
};

export interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children,
}) => {
  return (
    <section className={styles.root}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.card}>{children}</div>
    </section>
  );
};
