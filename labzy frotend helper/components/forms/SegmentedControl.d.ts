/** Segmented control for 2–4 exclusive options (e.g. Home collection / Walk-in). */
export interface SegmentedControlProps {
  /** Strings or { value, label } pairs */
  options: Array<string | { value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}
