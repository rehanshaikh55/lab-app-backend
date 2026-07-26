import type { IconName } from './Icon';

/** Labzy button — primary action control. */
export interface ButtonProps {
  /** @default 'primary' */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  /** @default 'md' — lg (52px) for screen-bottom CTAs */
  size?: 'sm' | 'md' | 'lg';
  /** Optional leading icon name */
  icon?: IconName;
  /** Stretch to container width (bottom CTAs) @default false */
  fullWidth?: boolean;
  /** @default false */
  disabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
