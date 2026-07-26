import React from 'react';

/** Toggle switch. */
export function Switch({ checked = false, onChange, disabled = false, label, style }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, ...style }}>
      <span
        role="switch"
        aria-checked={checked}
        onClick={disabled ? undefined : () => onChange && onChange(!checked)}
        style={{
          width: 48, height: 28, borderRadius: 'var(--radius-full)', flexShrink: 0,
          background: checked ? 'var(--teal-500)' : 'var(--neutral-200)',
          position: 'relative',
          transition: 'background var(--duration-base) var(--ease-out)',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3,
          width: 22, height: 22, borderRadius: 999, background: '#fff',
          boxShadow: '0 1px 3px rgba(13,38,35,0.25)',
          transition: 'left var(--duration-base) var(--ease-out)',
        }}></span>
      </span>
      {label ? <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>{label}</span> : null}
    </label>
  );
}
