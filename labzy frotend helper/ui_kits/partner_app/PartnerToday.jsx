import React from 'react';
import { Logo } from '../../components/core/Logo.jsx';
import { IconButton } from '../../components/core/IconButton.jsx';
import { Icon } from '../../components/core/Icon.jsx';
import { Card } from '../../components/core/Card.jsx';
import { Badge } from '../../components/core/Badge.jsx';
import { Button } from '../../components/core/Button.jsx';
import { Avatar } from '../../components/core/Avatar.jsx';

const TODAY_STATS = [
  { label: 'Bookings', value: '18' },
  { label: 'Home visits', value: '11' },
  { label: 'Reports due', value: '6' },
];

export function PartnerToday({ requests = [], onAccept, onDecline }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '12px var(--screen-pad-x) 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Logo size={20} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontWeight: 600 }}>HealthFirst Diagnostics · Partner</span>
        </div>
        <IconButton icon="bell" variant="outline" size={42} label="Notifications" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {TODAY_STATS.map((s) => (
          <Card key={s.label} padding="12px 14px">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-heavy)', fontFamily: 'var(--font-mono)' }}>{s.value}</span>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>{s.label}</span>
            </div>
          </Card>
        ))}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', flex: 1 }}>Incoming requests</h3>
          <Badge tone="booked" dot>{requests.length} new</Badge>
        </div>
        {requests.length === 0 ? (
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0', color: 'var(--text-muted)' }}>
              <Icon name="check" size={22} color="var(--success-500)" />
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>All caught up</span>
            </div>
          </Card>
        ) : requests.map((r) => (
          <Card key={r.id}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Avatar name={r.patient} size={40} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>{r.patient}</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{r.tests}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name={r.mode === 'Home collection' ? 'map-pin' : 'clock'} size={12} />
                    {r.mode} · {r.slot}
                  </span>
                </div>
                <span style={{ fontSize: 'var(--text-md)', fontWeight: 800 }}>₹{r.amount}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="outline" size="sm" style={{ flex: 1 }} onClick={() => onDecline && onDecline(r.id)}>Decline</Button>
                <Button size="sm" icon="check" style={{ flex: 2 }} onClick={() => onAccept && onAccept(r.id)}>Accept</Button>
              </div>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
