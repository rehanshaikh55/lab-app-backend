import React from 'react';

const AVATAR_HUES = ['var(--teal-500)', 'var(--info-500)', 'var(--status-sampled)', 'var(--warning-500)', 'var(--success-500)'];

/** Circular avatar with initials fallback. */
export function Avatar({ name = '', src, size = 40, style }) {
  const initials = name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const hue = AVATAR_HUES[(name.charCodeAt(0) || 0) % AVATAR_HUES.length];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 'var(--radius-full)',
        background: src ? 'var(--surface-sunken)' : hue,
        color: '#fff',
        fontSize: size * 0.38,
        fontWeight: 'var(--weight-bold)',
        overflow: 'hidden',
        flexShrink: 0,
        userSelect: 'none',
        ...style,
      }}
    >
      {src
        ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials}
    </span>
  );
}
