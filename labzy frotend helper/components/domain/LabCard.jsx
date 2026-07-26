import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Card } from '../core/Card.jsx';
import { Avatar } from '../core/Avatar.jsx';
import { Badge } from '../core/Badge.jsx';

/** Lab listing card — discovery results. */
export function LabCard({ name, rating, reviews, distance, eta, verified = true, homeCollection = true, onClick, style }) {
  return (
    <Card pressable={!!onClick} onClick={onClick} style={style}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Avatar name={name} size={46} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{name}</span>
            {verified ? <Icon name="shield-check" size={16} color="var(--teal-500)" /> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)' }}>
              <Icon name="star" size={13} color="var(--warning-500)" style={{ fill: 'var(--warning-500)' }} />
              {rating}
            </span>
            {reviews ? <span>({reviews})</span> : null}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name="navigation" size={12} />{distance}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {homeCollection ? <Badge tone="brand">Home collection</Badge> : null}
            {eta ? <Badge tone="neutral">{eta}</Badge> : null}
          </div>
        </div>
        <Icon name="chevron-right" size={18} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
      </div>
    </Card>
  );
}
