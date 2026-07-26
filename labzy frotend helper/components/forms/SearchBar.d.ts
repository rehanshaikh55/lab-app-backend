/** Pill search bar with optional filter button. */
export interface SearchBarProps {
  /** @default 'Search tests, packages, labs…' */
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** When set, shows the teal filter button */
  onFilter?: () => void;
  style?: React.CSSProperties;
}
