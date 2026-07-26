/** Status pill — lifecycle tones map to the booking journey. */
export interface BadgeProps {
  /** @default 'neutral' */
  tone?: 'neutral' | 'brand' | 'booked' | 'sampled' | 'processing' | 'ready' | 'cancelled';
  /** Leading status dot @default false */
  dot?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
