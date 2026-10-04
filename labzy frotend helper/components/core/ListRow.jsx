import React from 'react';
import { Icon } from './Icon.jsx';

/** Tappable list row: leading icon tile, title/subtitle, trailing chevron or custom node. */
export function ListRow({ icon, iconColor = 'var(--teal-600)', title, subtitle, trailing, chevron = true, onClick, style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 'var(--hit-target)',
        padding: '10px 4px',
        cursor: onClick ? 'pointer' : undefined,
        background: hover && onClick ? 'var(--surface-sunken)' : 'transparent',
        borderRadius: 'var(--radius-sm)',
        transition: 'background var(--duration-fast) var(--ease-out)',
        ...style,
      }}
    >
      {icon ? (
        <span style={{
          width: 38, height: 38, borderRadius: 'var(--radius-md)', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface-brand-soft)', color: iconColor,
        }}>
          <Icon name={icon} size={18} />
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>{title}</span>
        {subtitle ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{subtitle}</span> : null}
      </span>
      {trailing}
      {chevron && onClick ? <Icon name="chevron-right" size={18} color="var(--text-muted)" /> : null}
    </div>
  );
}
