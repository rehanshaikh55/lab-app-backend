import React from 'react';
import { TopBar } from '../../components/navigation/TopBar.jsx';
import { Card } from '../../components/core/Card.jsx';
import { Icon } from '../../components/core/Icon.jsx';
import { Badge } from '../../components/core/Badge.jsx';
import { Button } from '../../components/core/Button.jsx';
import { StatusTimeline } from '../../components/domain/StatusTimeline.jsx';

export function PatientBookings({ justBooked = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Your bookings" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px var(--screen-pad-x) 24px' }}>
        {justBooked ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            background: 'var(--success-soft)', borderRadius: 'var(--radius-md)',
            color: 'var(--success-500)', fontSize: 'var(--text-sm)', fontWeight: 700,
          }}>
            <Icon name="check" size={17} />
            Booking confirmed — we've texted the details
          </div>
        ) : null}

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)' }}>Lipid Profile + CBC</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>HealthFirst Diagnostics · Home collection</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>LBZ-48291</span>
              </div>
              <Badge tone="processing" dot>Processing</Badge>
            </div>
            <StatusTimeline current={2} />
            <div style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', alignItems: 'center' }}>
              <Icon name="clock" size={16} color="var(--teal-600)" />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', flex: 1 }}>
                Report expected by <strong style={{ color: 'var(--text-primary)' }}>2:00 PM today</strong>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" icon="phone" style={{ flex: 1 }}>Call lab</Button>
              <Button variant="secondary" size="sm" icon="file-text" style={{ flex: 1 }}>View tests</Button>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)' }}>HbA1c — quarterly re-test</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>CityLab Pathology · Walk-in</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>LBZ-48104 · Sat 14 Jun, 8:30 AM</span>
              </div>
              <Badge tone="booked" dot>Booked</Badge>
            </div>
            <StatusTimeline current={0} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" icon="calendar" style={{ flex: 1 }}>Reschedule</Button>
              <Button variant="ghost" size="sm" icon="x" style={{ flex: 1 }}>Cancel</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
