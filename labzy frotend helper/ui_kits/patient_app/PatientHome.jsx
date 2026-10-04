import React from 'react';
import { Logo } from '../../components/core/Logo.jsx';
import { IconButton } from '../../components/core/IconButton.jsx';
import { Icon } from '../../components/core/Icon.jsx';
import { Badge } from '../../components/core/Badge.jsx';
import { Card } from '../../components/core/Card.jsx';
import { Chip } from '../../components/core/Chip.jsx';
import { SearchBar } from '../../components/forms/SearchBar.jsx';
import { LabCard } from '../../components/domain/LabCard.jsx';
import { TestCard } from '../../components/domain/TestCard.jsx';

const HOME_CATEGORIES = [
  { key: 'blood', icon: 'droplet', label: 'Blood' },
  { key: 'fullbody', icon: 'shield-check', label: 'Full body' },
  { key: 'thyroid', icon: 'flask', label: 'Thyroid' },
  { key: 'diabetes', icon: 'clock', label: 'Diabetes' },
];

export function PatientHome({ onOpenLab, cart = {}, onToggleTest }) {
  const [cat, setCat] = React.useState('blood');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '12px var(--screen-pad-x) 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Logo size={22} />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="map-pin" size={13} />
            Indiranagar, Bengaluru
          </span>
        </div>
        <IconButton icon="bell" variant="outline" size={42} label="Notifications" />
      </div>

      <SearchBar onFilter={() => {}} />

      <Card style={{ background: 'var(--teal-800)', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Badge tone="ready" dot style={{ alignSelf: 'flex-start' }}>Report ready</Badge>
            <span style={{ color: '#fff', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)' }}>Lipid Profile — HealthFirst</span>
            <span style={{ color: 'var(--teal-200)', fontSize: 'var(--text-sm)' }}>Collected yesterday · 7:20 AM</span>
          </div>
          <span style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.14)', color: '#fff',
          }}>
            <Icon name="download" size={19} />
          </span>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {HOME_CATEGORIES.map((c) => (
          <Chip key={c.key} icon={c.icon} selected={cat === c.key} onClick={() => setCat(c.key)}>{c.label}</Chip>
        ))}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', flex: 1 }}>Labs near you</h3>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)', color: 'var(--teal-600)' }}>See all</span>
        </div>
        <LabCard name="HealthFirst Diagnostics" rating={4.8} reviews="1.2k" distance="0.8 km" eta="Reports in 6h" onClick={() => onOpenLab && onOpenLab('healthfirst')} />
        <LabCard name="CityLab Pathology" rating={4.6} reviews="860" distance="1.4 km" eta="Reports in 12h" onClick={() => onOpenLab && onOpenLab('citylab')} />
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)' }}>Popular tests</h3>
        <TestCard name="Complete Blood Count" description="26 parameters · whole blood" price={299} mrp={450} fasting reportEta="in 6 hrs" added={!!cart.cbc} onAdd={() => onToggleTest && onToggleTest('cbc')} />
        <TestCard name="HbA1c (Glycated Hb)" description="3-month sugar average" price={449} reportEta="in 8 hrs" added={!!cart.hba1c} onAdd={() => onToggleTest && onToggleTest('hba1c')} />
      </section>
    </div>
  );
}
