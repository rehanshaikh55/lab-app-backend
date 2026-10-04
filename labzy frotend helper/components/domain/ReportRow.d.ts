/** Report list row with lifecycle status and download action. */
export interface ReportRowProps {
  /** Test/package name */
  name: string;
  /** Lab name */
  lab?: string;
  /** e.g. '12 Jun' */
  date?: string;
  /** @default 'ready' */
  status?: 'booked' | 'sampled' | 'processing' | 'ready' | 'cancelled';
  onOpen?: () => void;
  /** Shows download button when status is 'ready' */
  onDownload?: () => void;
  style?: React.CSSProperties;
}
