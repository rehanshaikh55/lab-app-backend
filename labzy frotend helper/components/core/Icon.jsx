import React from 'react';

/* Lucide icon path data (ISC license, lucide.dev) — copied, not hand-drawn.
   Stroke style: 2px, round caps/joins, 24x24 viewBox. */
const P = (d) => ['path', { d }];
const ICONS = {
  'search': [['circle', { cx: 11, cy: 11, r: 8 }], P('m21 21-4.3-4.3')],
  'map-pin': [P('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'), ['circle', { cx: 12, cy: 10, r: 3 }]],
  'star': [['polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' }]],
  'calendar': [P('M8 2v4'), P('M16 2v4'), ['rect', { width: 18, height: 18, x: 3, y: 4, rx: 2 }], P('M3 10h18')],
  'file-text': [P('M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'), P('M14 2v4a2 2 0 0 0 2 2h4'), P('M10 9H8'), P('M16 13H8'), P('M16 17H8')],
  'home': [P('m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'), ['polyline', { points: '9 22 9 12 15 12 15 22' }]],
  'flask': [P('M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2'), P('M8.5 2h7'), P('M7 16.5h10')],
  'user': [P('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'), ['circle', { cx: 12, cy: 7, r: 4 }]],
  'bell': [P('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'), P('M10.3 21a1.94 1.94 0 0 0 3.4 0')],
  'chevron-right': [P('m9 18 6-6-6-6')],
  'chevron-left': [P('m15 18-6-6 6-6')],
  'chevron-down': [P('m6 9 6 6 6-6')],
  'download': [P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), ['polyline', { points: '7 10 12 15 17 10' }], ['line', { x1: 12, x2: 12, y1: 15, y2: 3 }]],
  'check': [P('M20 6 9 17l-5-5')],
  'clock': [['circle', { cx: 12, cy: 12, r: 10 }], ['polyline', { points: '12 6 12 12 16 14' }]],
  'x': [P('M18 6 6 18'), P('m6 6 12 12')],
  'plus': [P('M5 12h14'), P('M12 5v14')],
  'sliders': [['line', { x1: 21, x2: 14, y1: 4, y2: 4 }], ['line', { x1: 10, x2: 3, y1: 4, y2: 4 }], ['line', { x1: 21, x2: 12, y1: 12, y2: 12 }], ['line', { x1: 8, x2: 3, y1: 12, y2: 12 }], ['line', { x1: 21, x2: 16, y1: 20, y2: 20 }], ['line', { x1: 12, x2: 3, y1: 20, y2: 20 }], ['line', { x1: 14, x2: 14, y1: 2, y2: 6 }], ['line', { x1: 8, x2: 8, y1: 10, y2: 14 }], ['line', { x1: 16, x2: 16, y1: 18, y2: 22 }]],
  'droplet': [P('M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z')],
  'arrow-right': [P('M5 12h14'), P('m12 5 7 7-7 7')],
  'shield-check': [P('M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'), P('m9 12 2 2 4-4')],
  'navigation': [['polygon', { points: '3 11 22 2 13 21 11 13 3 11' }]],
  'credit-card': [['rect', { width: 20, height: 14, x: 2, y: 5, rx: 2 }], ['line', { x1: 2, x2: 22, y1: 10, y2: 10 }]],
  'phone': [P('M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z')],
  'repeat': [P('m17 2 4 4-4 4'), P('M3 11v-1a4 4 0 0 1 4-4h14'), P('m7 22-4-4 4-4'), P('M21 13v1a4 4 0 0 1-4 4H3')],
};

export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2, style }) {
  const parts = ICONS[name] || [];
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }} aria-hidden="true"
    >
      {parts.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(ICONS);
