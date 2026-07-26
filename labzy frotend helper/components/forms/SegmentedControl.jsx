import React from 'react';

/** Segmented control — 2–4 mutually exclusive options. */
export function SegmentedControl({ options = [], value, onChange, style }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4,
      background: 'var(--surface-sunken)',
      borderRadius: 'var(--radius-md)',
      ...style,
    }}>
      {options.map((opt) => {
        const key = typeof opt === 'string' ? opt : opt.value;
        const lbl = typeof opt === 'string' ? opt : opt.label;
        const active = key === value;
        return (
          <button
            key={key}
            onClick={() => onChange && onChange(key)}
            style={{
              flex: 1, height: 36, padding: '0 12px',
              borderRadius: 'var(--radius-sm)', border: 'none',
              fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-sans)',
              cursor: 'pointer', whiteSpace: 'nowrap',
              background: active ? 'var(--surface-card)' : 'transparent',
              color: active ? 'var(--teal-700)' : 'var(--text-secondary)',
              boxShadow: active ? 'var(--shadow-card)' : 'none',
              transition: 'all var(--duration-fast) var(--ease-out)',
            }}
          >
            {lbl}
          </button>
        );
      })}
    </div>
  );
}
