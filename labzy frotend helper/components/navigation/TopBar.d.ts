/** Mobile top app bar. */
export interface TopBarProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Shows leading back chevron */
  onBack?: () => void;
  /** Trailing node (IconButton, Badge…) */
  action?: React.ReactNode;
  /** @default false */
  transparent?: boolean;
  style?: React.CSSProperties;
}
