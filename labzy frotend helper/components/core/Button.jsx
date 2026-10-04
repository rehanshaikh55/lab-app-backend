import React from 'react';
import { Icon } from './Icon.jsx';

const BTN_VARIANTS = {
  primary:   { background: 'var(--teal-500)', color: 'var(--text-on-brand)', border: '1px solid transparent' },
  secondary: { background: 'var(--surface-brand-soft)', color: 'var(--teal-700)', border: '1px solid var(--teal-200)' },
  outline:   { background: 'var(--surface-card)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' },
  ghost:     { background: 'transparent', color: 'var(--teal-600)', border: '1px solid transparent' },
  danger:    { background: 'var(--danger-500)', color: '#FFFFFF', border: '1px solid transparent' },
};

const BTN_HOVER = {
  primary:   { background: 'var(--teal-600)' },
  secondary: { background: 'var(--teal-100)' },
  outline:   { background: 'var(--surface-sunken)' },
  ghost:     { background: 'var(--surface-brand-soft)' },
  danger:    { background: '#B83330' },
};

const BTN_SIZES = {
  sm: { height: 'var(--control-h-sm)', padding: '0 14px', fontSize: 'var(--text-sm)', gap: 6, iconSize: 16 },
  md: { height: 'var(--control-h-md)', padding: '0 18px', fontSize: 'var(--text-base)', gap: 8, iconSize: 18 },
  lg: { height: 'var(--control-h-lg)', padding: '0 22px', fontSize: 'var(--text-md)', gap: 8, iconSize: 20 },
};

/** Primary action control. */
export function Button({
  variant = 'primary', size = 'md', icon, fullWidth = false,
  disabled = false, children, style, onClick, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.primary;
  const s = BTN_SIZES[size] || BTN_SIZES.md;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      disabled={disabled}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.height,
        padding: s.padding,
        fontSize: s.fontSize,
        fontFamily: 'var(--font-sans)',
        fontWeight: 'var(--weight-bold)',
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)',
        transform: press && !disabled ? 'scale(0.97)' : 'none',
        ...v,
        ...(hover && !disabled ? BTN_HOVER[variant] : null),
        ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={s.iconSize} /> : null}
      {children}
    </button>
  );
}
