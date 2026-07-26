/** Circular avatar; deterministic brand-hue initials when no image. */
export interface AvatarProps {
  /** Person or lab name (initials fallback) */
  name?: string;
  /** Image URL */
  src?: string;
  /** Diameter in px @default 40 */
  size?: number;
  style?: React.CSSProperties;
}
