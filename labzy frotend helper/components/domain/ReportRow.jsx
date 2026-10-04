import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Badge } from '../core/Badge.jsx';

const REPORT_STATUS = {
  ready:      { tone: 'ready', label: 'Ready' },
  processing: { tone: 'processing', label: 'Processing' },
  sampled:    { tone: 'sampled', label: 'Sample collected' },
  booked:     { tone: 'booked', label: 'Booked' },
  cancelled:  { tone: 'cancelled', label: 'Cancelled' },
};

/** Report list row — test name, lab, date, status; download when ready. */
export function ReportRow({ name, lab, date, status = 'ready', onOpen, onDownload, style }) {
  const [hover, setHover] = React.useState(false);
  const st = REPORT_STATUS[status] || REPORT_STATUS.ready;
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px',
        background: hover && onOpen ? 'var(--surface-sunken)' : 'var(--surface-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        cursor: onOpen ? 'pointer' : undefined,
        transition: 'background var(--duration-fast) var(--ease-out)',
        ...style,
      }}
    >
      <span style={{
        width: 40, height: 40, borderRadius: 'var(--radius-md)', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: status === 'ready' ? 'var(--status-ready-soft)' : 'var(--surface-sunken)',
        color: status === 'ready' ? 'var(--status-ready)' : 'var(--text-muted)',
      }}>
        <Icon name="file-text" size={19} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{
          fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{name}</span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{lab}{date ? ` · ${date}` : ''}</span>
      </div>
      <Badge tone={st.tone} dot>{st.label}</Badge>
      {status === 'ready' && onDownload ? (
        <button
          aria-label="Download report"
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          style={{
            width: 38, height: 38, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)', color: 'var(--teal-600)', cursor: 'pointer',
          }}
        >
          <Icon name="download" size={17} />
        </button>
      ) : null}
    </div>
  );
}
