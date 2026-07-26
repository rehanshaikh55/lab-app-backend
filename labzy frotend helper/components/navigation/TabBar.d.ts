import type { IconName } from '../core/Icon';

export interface TabBarItem {
  key: string;
  icon: IconName;
  label: string;
  /** Notification count bubble */
  badge?: number | string;
}

/** Bottom tab bar — 3–5 items. */
export interface TabBarProps {
  items: TabBarItem[];
  /** Active item key */
  active?: string;
  onChange?: (key: string) => void;
  style?: React.CSSProperties;
}
