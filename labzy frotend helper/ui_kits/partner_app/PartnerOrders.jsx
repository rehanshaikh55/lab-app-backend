import React from 'react';
import { TopBar } from '../../components/navigation/TopBar.jsx';
import { Card } from '../../components/core/Card.jsx';
import { Icon } from '../../components/core/Icon.jsx';
import { Badge } from '../../components/core/Badge.jsx';
import { Button } from '../../components/core/Button.jsx';
import { SegmentedControl } from '../../components/forms/SegmentedControl.jsx';

const STAGE_FLOW = ['booked', 'sampled', 'processing', 'ready'];
const STAGE_META = {
  booked:     { tone: 'booked', label: 'Booked', action: 'Mark sample collected', icon: 'droplet' },
  sampled:    { tone: 'sampled', label: 'Sample collected', action: 'Start processing', icon: 'flask' },
  processing: { tone: 'processing', label: 'Processing', action: 'Upload report', icon: 'file-text' },
  ready:      { tone: 'ready', label: 'Report sent', action: null, icon: null },
};

export function PartnerOrders({ orders = [], onAdvance }) {
  const [filter, setFilter] = React.useState('Active');
  const visible = filter === 'Active' ? orders.filter((o) => o.stage !== 'ready') : orders;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Today's orders" subtitle="Thu 12 Jun" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px var(--screen-pad-x) 24px' }}>
        <SegmentedControl options={['Active', 'All']} value={filter} onChange={setFilter} />
        {visible.map((o) => {
          const meta = STAGE_META[o.stage];
          return (
            <Card key={o.id}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>{o.patient}</span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{o.tests}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{o.id} · {o.slot}</span>
                  </div>
                  <Badge tone={meta.tone} dot>{meta.label}</Badge>
                </div>
                {meta.action ? (
                  <Button variant={o.stage === 'processing' ? 'primary' : 'secondary'} size="sm" icon={meta.icon} onClick={() => onAdvance && onAdvance(o.id)}>
                    {meta.action}
                  </Button>
                ) : (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--success-500)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="check" size={15} />Delivered to patient
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export { STAGE_FLOW };
