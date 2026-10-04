import React from 'react';
import { IconButton } from '../core/IconButton.jsx';

/** Mobile top app bar: back button, title/subtitle, trailing action. */
export function TopBar({ title, subtitle, onBack, action, transparent = false, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      height: 56, padding: '0 var(--screen-pad-x)',
      background: transparent ? 'transparent' : 'var(--surface-page)',
      ...style,
    }}>
      {onBack ? <IconButton icon="chevron-left" variant="ghost" size={40} label="Back" onClick={onBack} style={{ marginLeft: -10 }} /> : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{
          fontSize: 'var(--text-md)', fontWeight: 'var(--weight-heavy)', color: 'var(--text-primary)',
          letterSpacing: 'var(--tracking-tight)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{title}</span>
        {subtitle ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{subtitle}</span> : null}
      </div>
      {action}
    </div>
  );
}
