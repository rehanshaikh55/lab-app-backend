import React from 'react';
import { Icon } from './Icon.jsx';

const IB_VARIANTS = {
  subtle: { background: 'var(--surface-sunken)', color: 'var(--neutral-700)', border: '1px solid transparent' },
  outline: { background: 'var(--surface-card)', color: 'var(--neutral-700)', border: '1px solid var(--border-strong)' },
  brand: { background: 'var(--teal-500)', color: '#FFFFFF', border: '1px solid transparent' },
  ghost: { background: 'transparent', color: 'var(--neutral-600)', border: '1px solid transparent' },
};

/** Square icon-only button (44px hit target). */
export function IconButton({ icon, variant = 'subtle', size = 44, label, disabled = false, style, onClick, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const v = IB_VARIANTS[variant] || IB_VARIANTS.subtle;
  return (
    <button
      aria-label={label || icon}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        filter: hover && !disabled ? 'brightness(0.95)' : 'none',
        transition: 'filter var(--duration-fast) var(--ease-out)',
        ...v,
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </button>
  );
}
