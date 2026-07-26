/** Labzy wordmark lockup (CSS text, scales crisply). */
export interface LogoProps {
  /** Font size in px @default 24 */
  size?: number;
  /** 'default' = teal+charcoal on light; 'white' = knockout for dark/brand surfaces @default 'default' */
  tone?: 'default' | 'white';
  style?: React.CSSProperties;
}
