import React from 'react';
import { Icon } from '../core/Icon.jsx';

const TIMELINE_STEPS = [
  { key: 'booked', label: 'Booked', icon: 'calendar' },
  { key: 'sampled', label: 'Sampled', icon: 'droplet' },
  { key: 'processing', label: 'Processing', icon: 'flask' },
  { key: 'ready', label: 'Report ready', icon: 'file-text' },
];

/** Horizontal booking progress timeline. current: index 0–3. */
export function StatusTimeline({ current = 0, steps = TIMELINE_STEPS, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', ...style }}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={step.key}>
            {i > 0 ? (
              <span style={{
                flex: 1, height: 3, marginTop: 16, borderRadius: 2,
                background: i <= current ? 'var(--teal-500)' : 'var(--neutral-100)',
                transition: 'background var(--duration-slow) var(--ease-out)',
              }}></span>
            ) : null}
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 64, flexShrink: 0 }}>
              <span style={{
                width: 34, height: 34, borderRadius: 999,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: done || active ? 'var(--teal-500)' : 'var(--surface-sunken)',
                color: done || active ? '#fff' : 'var(--neutral-400)',
                boxShadow: active ? 'var(--focus-ring)' : 'none',
                transition: 'all var(--duration-base) var(--ease-out)',
              }}>
                <Icon name={done ? 'check' : step.icon} size={16} />
              </span>
              <span style={{
                fontSize: 'var(--text-xs)', textAlign: 'center', lineHeight: 1.25,
                fontWeight: active ? 'var(--weight-bold)' : 'var(--weight-medium)',
                color: active ? 'var(--teal-700)' : done ? 'var(--text-secondary)' : 'var(--text-muted)',
              }}>{step.label}</span>
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
