import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Labeled text input with optional leading icon, hint and error. */
export function Input({ label, placeholder, value, onChange, icon, hint, error, type = 'text', disabled = false, style }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label ? <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{label}</span> : null}
      <span style={{
        display: 'flex', alignItems: 'center', gap: 10,
        height: 'var(--control-h-md)', padding: '0 14px',
        background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
        border: error ? '1.5px solid var(--danger-500)' : focus ? '1.5px solid var(--teal-500)' : '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        boxShadow: focus && !error ? 'var(--focus-ring)' : 'none',
        transition: 'border var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
      }}>
        {icon ? <Icon name={icon} size={17} color="var(--text-muted)" /> : null}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 'var(--text-base)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
          }}
        />
      </span>
      {error
        ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--danger-500)', fontWeight: 'var(--weight-medium)' }}>{error}</span>
        : hint
          ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{hint}</span>
          : null}
    </label>
  );
}
