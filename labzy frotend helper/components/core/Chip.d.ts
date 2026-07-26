import type { IconName } from './Icon';

/** Selectable filter chip (test categories, sort options). */
export interface ChipProps {
  /** @default false */
  selected?: boolean;
  /** Optional leading icon */
  icon?: IconName;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
