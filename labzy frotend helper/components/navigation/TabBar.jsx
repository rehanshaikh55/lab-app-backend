import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Bottom tab bar. items: [{ key, icon, label, badge? }] */
export function TabBar({ items = [], active, onChange, style }) {
  return (
    <nav style={{
      display: 'flex',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-default)',
      padding: '6px 8px 10px',
      ...style,
    }}>
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <button
            key={it.key}
            onClick={() => onChange && onChange(it.key)}
            style={{
              flex: 1, minHeight: 'var(--hit-target)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: isActive ? 'var(--teal-600)' : 'var(--neutral-400)',
              fontFamily: 'var(--font-sans)',
              transition: 'color var(--duration-fast) var(--ease-out)',
            }}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon name={it.icon} size={22} strokeWidth={isActive ? 2.4 : 2} />
              {it.badge ? (
                <span style={{
                  position: 'absolute', top: -3, right: -7,
                  minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999,
                  background: 'var(--danger-500)', color: '#fff',
                  fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{it.badge}</span>
              ) : null}
            </span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: isActive ? 'var(--weight-bold)' : 'var(--weight-medium)' }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
