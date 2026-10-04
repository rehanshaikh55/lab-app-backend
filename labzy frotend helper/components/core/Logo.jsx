import React from 'react';

/** Labzy wordmark lockup: "LAB" teal + "ZY" charcoal, heavy italic. */
export function Logo({ size = 24, tone = 'default', style }) {
  const lab = tone === 'white' ? '#FFFFFF' : 'var(--teal-500)';
  const zy = tone === 'white' ? 'rgba(255,255,255,0.72)' : 'var(--logo-charcoal)';
  return (
    <span
      style={{
        fontFamily: 'var(--font-logo)',
        fontStyle: 'italic',
        fontWeight: 800,
        fontSize: size,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...style,
      }}
    >
      <span style={{ color: lab }}>LAB</span>
      <span style={{ color: zy }}>ZY</span>
    </span>
  );
}
