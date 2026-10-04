import type { IconName } from '../core/Icon';

/** Labeled text input. */
export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Leading icon */
  icon?: IconName;
  /** Helper text below */
  hint?: string;
  /** Error message — switches border to danger */
  error?: string;
  /** @default 'text' */
  type?: string;
  /** @default false */
  disabled?: boolean;
  style?: React.CSSProperties;
}
