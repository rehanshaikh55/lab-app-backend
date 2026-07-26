/** White surface container with Labzy card styling. */
export interface CardProps {
  /** CSS padding @default 'var(--card-pad)' (16px) */
  padding?: string;
  /** Adds press-shrink affordance @default false */
  pressable?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
