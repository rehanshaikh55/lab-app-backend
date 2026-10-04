import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Rounded search bar — the discovery entry point. */
export function SearchBar({ placeholder = 'Search tests, packages, labs…', value, onChange, onFilter, style }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ display: 'flex', gap: 10, ...style }}>
      <span style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 10,
        height: 'var(--control-h-md)', padding: '0 16px',
        background: 'var(--surface-card)',
        border: focus ? '1.5px solid var(--teal-500)' : '1px solid var(--border-default)',
        borderRadius: 'var(--radius-full)',
        boxShadow: focus ? 'var(--focus-ring)' : 'var(--shadow-card)',
        transition: 'border var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)',
      }}>
        <Icon name="search" size={18} color={focus ? 'var(--teal-600)' : 'var(--text-muted)'} />
        <input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 'var(--text-base)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
          }}
        />
      </span>
      {onFilter ? (
        <button
          aria-label="Filters"
          onClick={onFilter}
          style={{
            width: 'var(--control-h-md)', height: 'var(--control-h-md)', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--teal-500)', color: '#fff', border: 'none',
            borderRadius: 'var(--radius-full)', cursor: 'pointer', boxShadow: 'var(--shadow-card)',
          }}
        >
          <Icon name="sliders" size={18} />
        </button>
      ) : null}
    </div>
  );
}
