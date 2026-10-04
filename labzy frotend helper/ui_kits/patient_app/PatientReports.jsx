import React from 'react';
import { TopBar } from '../../components/navigation/TopBar.jsx';
import { IconButton } from '../../components/core/IconButton.jsx';
import { Card } from '../../components/core/Card.jsx';
import { SegmentedControl } from '../../components/forms/SegmentedControl.jsx';
import { Switch } from '../../components/forms/Switch.jsx';
import { ReportRow } from '../../components/domain/ReportRow.jsx';

const REPORT_VALUES = [
  { name: 'Total cholesterol', value: '186 mg/dL', range: '< 200', flag: null },
  { name: 'LDL', value: '128 mg/dL', range: '< 100', flag: 'high' },
  { name: 'HDL', value: '52 mg/dL', range: '> 40', flag: null },
  { name: 'Triglycerides', value: '142 mg/dL', range: '< 150', flag: null },
];

export function PatientReports() {
  const [filter, setFilter] = React.useState('All');
  const [open, setOpen] = React.useState(true);
  const [remind, setRemind] = React.useState(true);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TopBar title="Reports" action={<IconButton icon="search" size={40} variant="ghost" label="Search reports" />} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px var(--screen-pad-x) 24px' }}>
        <SegmentedControl options={['All', 'Ready', 'Pending']} value={filter} onChange={setFilter} />

        <ReportRow name="Lipid Profile" lab="HealthFirst" date="12 Jun" status="ready" onOpen={() => setOpen(!open)} onDownload={() => {}} />

        {open ? (
          <Card style={{ marginTop: -6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px 18px', alignItems: 'baseline' }}>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--tracking-overline)', color: 'var(--text-muted)' }}>Parameter</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--tracking-overline)', color: 'var(--text-muted)', textAlign: 'right' }}>Value</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--tracking-overline)', color: 'var(--text-muted)', textAlign: 'right' }}>Range</span>
                {REPORT_VALUES.map((r) => (
                  <React.Fragment key={r.name}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{r.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600, textAlign: 'right', color: r.flag ? 'var(--danger-500)' : 'var(--text-primary)' }}>
                      {r.value}{r.flag ? ' ↑' : ''}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'right' }}>{r.range}</span>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 12 }}>
                <Switch checked={remind} onChange={setRemind} label="Remind me to re-test in 3 months" />
              </div>
            </div>
          </Card>
        ) : null}

        <ReportRow name="HbA1c" lab="CityLab" date="Today" status="processing" onOpen={() => {}} />
        <ReportRow name="Complete Blood Count" lab="HealthFirst" date="28 May" status="ready" onOpen={() => {}} onDownload={() => {}} />
        <ReportRow name="Vitamin D, 25-OH" lab="CityLab" date="3 Apr" status="ready" onOpen={() => {}} onDownload={() => {}} />
      </div>
    </div>
  );
}
