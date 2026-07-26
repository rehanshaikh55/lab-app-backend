/** Diagnostic test or health-package card. */
export interface TestCardProps {
  name: string;
  /** e.g. '26 parameters · whole blood' */
  description?: string;
  /** Rupee amount, no symbol */
  price: number | string;
  /** Struck-through original price */
  mrp?: number | string;
  /** @default false */
  fasting?: boolean;
  /** e.g. 'in 6 hrs' */
  reportEta?: string;
  /** Toggles the Add button to Added state @default false */
  added?: boolean;
  onAdd?: () => void;
  onClick?: () => void;
  style?: React.CSSProperties;
}
