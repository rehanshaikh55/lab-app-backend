import React from 'react';

/** Surface container — white, 16px radius, soft shadow. */
export function Card({ padding = 'var(--card-pad)', pressable = false, onClick, children, style }) {
  const [press, setPress] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseDown={pressable ? () => setPress(true) : undefined}
      onMouseUp={pressable ? () => setPress(false) : undefined}
      onMouseLeave={pressable ? () => setPress(false) : undefined}
      style={{
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--border-default)',
        padding,
        cursor: pressable ? 'pointer' : undefined,
        transform: press ? 'scale(0.985)' : 'none',
        transition: 'transform var(--duration-fast) var(--ease-out)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
