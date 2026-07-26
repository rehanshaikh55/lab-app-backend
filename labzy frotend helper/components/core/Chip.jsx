import React from 'react';
import { Icon } from './Icon.jsx';

/** Selectable filter chip. */
export function Chip({ selected = false, icon, onClick, children, style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 36,
        padding: '0 14px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-semibold)',
        fontFamily: 'var(--font-sans)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        background: selected ? 'var(--teal-500)' : hover ? 'var(--surface-sunken)' : 'var(--surface-card)',
        color: selected ? '#fff' : 'var(--neutral-700)',
        border: selected ? '1px solid var(--teal-500)' : '1px solid var(--border-strong)',
        transition: 'background var(--duration-fast) var(--ease-out)',
        ...style,
      }}
    >
      {icon ? <Icon name={icon} size={15} /> : null}
      {children}
    </button>
  );
}
