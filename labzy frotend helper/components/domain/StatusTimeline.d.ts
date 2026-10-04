import type { IconName } from '../core/Icon';

export interface TimelineStep {
  key: string;
  label: string;
  icon: IconName;
}

/** Horizontal booking progress timeline (Booked → Sampled → Processing → Ready). */
export interface StatusTimelineProps {
  /** Index of the active step (0-based) @default 0 */
  current?: number;
  /** Override the default 4 lifecycle steps */
  steps?: TimelineStep[];
  style?: React.CSSProperties;
}
