export type IconName =
  | 'search' | 'map-pin' | 'star' | 'calendar' | 'file-text' | 'home' | 'flask'
  | 'user' | 'bell' | 'chevron-right' | 'chevron-left' | 'chevron-down'
  | 'download' | 'check' | 'clock' | 'x' | 'plus' | 'sliders' | 'droplet'
  | 'arrow-right' | 'shield-check' | 'navigation' | 'credit-card' | 'phone' | 'repeat';

/** Lucide-based line icon. 2px stroke, round caps. */
export interface IconProps {
  /** Icon name from the Labzy set */
  name: IconName;
  /** Square size in px @default 20 */
  size?: number;
  /** Stroke color @default 'currentColor' */
  color?: string;
  /** @default 2 */
  strokeWidth?: number;
  style?: React.CSSProperties;
}
