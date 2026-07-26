import type { IconName } from './Icon';

/** Tappable settings/list row. */
export interface ListRowProps {
  /** Leading icon (rendered in a soft teal tile) */
  icon?: IconName;
  /** @default 'var(--teal-600)' */
  iconColor?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Custom trailing node (badge, value) */
  trailing?: React.ReactNode;
  /** Show trailing chevron when tappable @default true */
  chevron?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
