/** Toggle switch (reminders, preferences). */
export interface SwitchProps {
  /** @default false */
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** @default false */
  disabled?: boolean;
  /** Inline label to the right */
  label?: string;
  style?: React.CSSProperties;
}
