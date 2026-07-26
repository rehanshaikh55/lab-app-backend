import React from 'react';

const BADGE_TONES = {
  neutral:    { background: 'var(--surface-sunken)', color: 'var(--neutral-600)' },
  brand:      { background: 'var(--surface-brand-soft)', color: 'var(--teal-700)' },
  booked:     { background: 'var(--status-booked-soft)', color: 'var(--status-booked)' },
  sampled:    { background: 'var(--status-sampled-soft)', color: 'var(--status-sampled)' },
  processing: { background: 'var(--status-processing-soft)', color: 'var(--status-processing)' },
  ready:      { background: 'var(--status-ready-soft)', color: 'var(--status-ready)' },
  cancelled:  { background: 'var(--status-cancelled-soft)', color: 'var(--status-cancelled)' },
};

/** Small status pill. */
export function Badge({ tone = 'neutral', dot = false, children, style }) {
  const t = BADGE_TONES[tone] || BADGE_TONES.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 24,
        padding: '0 10px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-bold)',
        whiteSpace: 'nowrap',
        ...t,
        ...style,
      }}
    >
      {dot ? <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor', flexShrink: 0 }}></span> : null}
      {children}
    </span>
  );
}
