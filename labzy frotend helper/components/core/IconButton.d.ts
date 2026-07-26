import type { IconName } from './Icon';

/** Icon-only square button. */
export interface IconButtonProps {
  icon: IconName;
  /** @default 'subtle' */
  variant?: 'subtle' | 'outline' | 'brand' | 'ghost';
  /** Width/height in px @default 44 */
  size?: number;
  /** Accessible label (falls back to icon name) */
  label?: string;
  /** @default false */
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
