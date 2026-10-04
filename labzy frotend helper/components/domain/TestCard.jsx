import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Card } from '../core/Card.jsx';
import { Button } from '../core/Button.jsx';

/** Diagnostic test / package card with price and add action. */
export function TestCard({ name, description, price, mrp, fasting = false, reportEta, added = false, onAdd, onClick, style }) {
  return (
    <Card pressable={!!onClick} onClick={onClick} style={style}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{
            width: 38, height: 38, borderRadius: 'var(--radius-md)', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-brand-soft)', color: 'var(--teal-600)',
          }}>
            <Icon name="flask" size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>{name}</span>
            {description ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{description}</span> : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-muted)' }}>
          {fasting ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={13} />Fasting required</span> : null}
          {reportEta ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="file-text" size={13} />Report {reportEta}</span> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-heavy)', color: 'var(--text-primary)' }}>₹{price}</span>
          {mrp ? <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₹{mrp}</span> : null}
          <span style={{ flex: 1 }}></span>
          <Button
            size="sm"
            variant={added ? 'secondary' : 'primary'}
            icon={added ? 'check' : 'plus'}
            onClick={(e) => { if (e && e.stopPropagation) e.stopPropagation(); if (onAdd) onAdd(); }}
          >
            {added ? 'Added' : 'Add'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
