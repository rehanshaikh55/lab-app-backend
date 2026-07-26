/** Lab listing card for discovery results. */
export interface LabCardProps {
  name: string;
  /** e.g. 4.8 */
  rating?: number | string;
  /** Review count, e.g. '1.2k' */
  reviews?: string;
  /** e.g. '0.8 km' */
  distance?: string;
  /** Report turnaround, e.g. 'Reports in 6h' */
  eta?: string;
  /** Shows the teal shield @default true */
  verified?: boolean;
  /** @default true */
  homeCollection?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
