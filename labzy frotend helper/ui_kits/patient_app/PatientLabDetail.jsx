import React from 'react';
import { TopBar } from '../../components/navigation/TopBar.jsx';
import { IconButton } from '../../components/core/IconButton.jsx';
import { Icon } from '../../components/core/Icon.jsx';
import { Avatar } from '../../components/core/Avatar.jsx';
import { Badge } from '../../components/core/Badge.jsx';
import { Button } from '../../components/core/Button.jsx';
import { SegmentedControl } from '../../components/forms/SegmentedControl.jsx';
import { TestCard } from '../../components/domain/TestCard.jsx';

const SLOT_DATES = [
  { key: 'today', day: 'Thu', date: '12' },
  { key: 'fri', day: 'Fri', date: '13' },
  { key: 'sat', day: 'Sat', date: '14' },
  { key: 'sun', day: 'Sun', date: '15' },
];
const SLOT_TIMES = ['6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM'];

export function PatientLabDetail({ onBack, onBook, cart = {}, onToggleTest }) {
  const [mode, setMode] = React.useState('Home collection');
  const [date, setDate] = React.useState('today');
  const [time, setTime] = React.useState('7:00 AM');
  const count = Object.values(cart).filter(Boolean).length;
  const total = (cart.cbc ? 299 : 0) + (cart.hba1c ? 449 : 0) + (cart.lipid ? 549 : 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <TopBar title="HealthFirst Diagnostics" onBack={onBack} action={<IconButton icon="phone" size={40} variant="ghost" label="Call lab" />} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, padding: '4px var(--screen-pad-x) 24px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Avatar name="HealthFirst Diagnostics" size={52} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-heavy)' }}>HealthFirst Diagnostics</span>
              <Icon name="shield-check" size={16} color="var(--teal-500)" />
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', alignItems: 'center' }}>
              <span style={{ fontWeight: 'var(--weight-bold)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="star" size={13} color="var(--warning-500)" />4.8
              </span>
              <span>0.8 km · Indiranagar</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Badge tone="brand">NABL accredited</Badge>
              <Badge tone="neutral">Since 2014</Badge>
            </div>
          </div>
        </div>

        <SegmentedControl options={['Home collection', 'Walk-in']} value={mode} onChange={setMode} />

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>Pick a date</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            {SLOT_DATES.map((d) => {
              const active = date === d.key;
              return (
                <button key={d.key} onClick={() => setDate(d.key)} style={{
                  flex: 1, height: 62, borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  background: active ? 'var(--teal-500)' : 'var(--surface-card)',
                  color: active ? '#fff' : 'var(--text-primary)',
                  border: active ? '1px solid var(--teal-500)' : '1px solid var(--border-strong)',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all var(--duration-fast) var(--ease-out)',
                }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, opacity: active ? 0.85 : 0.6 }}>{d.day}</span>
                  <span style={{ fontSize: 'var(--text-md)', fontWeight: 800 }}>{d.date}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>Time slot</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {SLOT_TIMES.map((t) => {
              const active = time === t;
              return (
                <button key={t} onClick={() => setTime(t)} style={{
                  height: 40, borderRadius: 'var(--radius-full)', cursor: 'pointer',
                  fontSize: 'var(--text-sm)', fontWeight: 700, fontFamily: 'var(--font-sans)',
                  background: active ? 'var(--surface-brand-soft)' : 'var(--surface-card)',
                  color: active ? 'var(--teal-700)' : 'var(--text-secondary)',
                  border: active ? '1.5px solid var(--teal-500)' : '1px solid var(--border-strong)',
                  transition: 'all var(--duration-fast) var(--ease-out)',
                }}>{t}</button>
              );
            })}
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-bold)' }}>Add tests</h4>
          <TestCard name="Lipid Profile" description="8 parameters · fasting serum" price={549} mrp={700} fasting reportEta="in 6 hrs" added={!!cart.lipid} onAdd={() => onToggleTest && onToggleTest('lipid')} />
          <TestCard name="Complete Blood Count" description="26 parameters · whole blood" price={299} mrp={450} reportEta="in 6 hrs" added={!!cart.cbc} onAdd={() => onToggleTest && onToggleTest('cbc')} />
        </section>
      </div>

      <div style={{
        position: 'sticky', bottom: 0, padding: '12px var(--screen-pad-x) 16px',
        background: 'var(--surface-card)', borderTop: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontWeight: 600 }}>{count} test{count === 1 ? '' : 's'}</span>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>₹{total}</span>
        </div>
        <Button size="lg" icon="calendar" fullWidth disabled={count === 0} onClick={onBook} style={{ flex: 1 }}>
          Book {time}
        </Button>
      </div>
    </div>
  );
}
