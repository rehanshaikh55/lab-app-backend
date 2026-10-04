/* @ds-bundle: {"format":3,"namespace":"LabzyDesignSystem_f16231","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"ICON_NAMES","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"ListRow","sourcePath":"components/core/ListRow.jsx"},{"name":"Logo","sourcePath":"components/core/Logo.jsx"},{"name":"LabCard","sourcePath":"components/domain/LabCard.jsx"},{"name":"ReportRow","sourcePath":"components/domain/ReportRow.jsx"},{"name":"StatusTimeline","sourcePath":"components/domain/StatusTimeline.jsx"},{"name":"TestCard","sourcePath":"components/domain/TestCard.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"SearchBar","sourcePath":"components/forms/SearchBar.jsx"},{"name":"SegmentedControl","sourcePath":"components/forms/SegmentedControl.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"},{"name":"PartnerOrders","sourcePath":"ui_kits/partner_app/PartnerOrders.jsx"},{"name":"STAGE_FLOW","sourcePath":"ui_kits/partner_app/PartnerOrders.jsx"},{"name":"PartnerToday","sourcePath":"ui_kits/partner_app/PartnerToday.jsx"},{"name":"PatientBookings","sourcePath":"ui_kits/patient_app/PatientBookings.jsx"},{"name":"PatientHome","sourcePath":"ui_kits/patient_app/PatientHome.jsx"},{"name":"PatientLabDetail","sourcePath":"ui_kits/patient_app/PatientLabDetail.jsx"},{"name":"PatientReports","sourcePath":"ui_kits/patient_app/PatientReports.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"7d0041d8dbd9","components/core/Badge.jsx":"7a11598da50e","components/core/Button.jsx":"ae7e858ae0c8","components/core/Card.jsx":"2dc1c13371f4","components/core/Chip.jsx":"7c0a28d721b6","components/core/Icon.jsx":"8e6c123d4c83","components/core/IconButton.jsx":"1d379ec6aadb","components/core/ListRow.jsx":"96832ccf2c71","components/core/Logo.jsx":"27f4c19f74f3","components/domain/LabCard.jsx":"f6e781a547e3","components/domain/ReportRow.jsx":"9bde46be8902","components/domain/StatusTimeline.jsx":"14668eb430c6","components/domain/TestCard.jsx":"1a4d3f753a66","components/forms/Input.jsx":"cde6007a18db","components/forms/SearchBar.jsx":"13dec4135541","components/forms/SegmentedControl.jsx":"7410e125a83e","components/forms/Switch.jsx":"225f6792b307","components/navigation/TabBar.jsx":"d1233840a0f9","components/navigation/TopBar.jsx":"181b2b3e5f8e","ui_kits/partner_app/PartnerOrders.jsx":"e8a097ca95b1","ui_kits/partner_app/PartnerToday.jsx":"7b7ee8891e49","ui_kits/patient_app/PatientBookings.jsx":"a7aa1e1fa04a","ui_kits/patient_app/PatientHome.jsx":"1762e83ad9e0","ui_kits/patient_app/PatientLabDetail.jsx":"f68e9e9bc6f9","ui_kits/patient_app/PatientReports.jsx":"c8263e870d8e"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.LabzyDesignSystem_f16231 = window.LabzyDesignSystem_f16231 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
const AVATAR_HUES = ['var(--teal-500)', 'var(--info-500)', 'var(--status-sampled)', 'var(--warning-500)', 'var(--success-500)'];

/** Circular avatar with initials fallback. */
function Avatar({
  name = '',
  src,
  size = 40,
  style
}) {
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const hue = AVATAR_HUES[(name.charCodeAt(0) || 0) % AVATAR_HUES.length];
  return /*#__PURE__*/React.createElement("span", {
    style: {
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
      ...style
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const BADGE_TONES = {
  neutral: {
    background: 'var(--surface-sunken)',
    color: 'var(--neutral-600)'
  },
  brand: {
    background: 'var(--surface-brand-soft)',
    color: 'var(--teal-700)'
  },
  booked: {
    background: 'var(--status-booked-soft)',
    color: 'var(--status-booked)'
  },
  sampled: {
    background: 'var(--status-sampled-soft)',
    color: 'var(--status-sampled)'
  },
  processing: {
    background: 'var(--status-processing-soft)',
    color: 'var(--status-processing)'
  },
  ready: {
    background: 'var(--status-ready-soft)',
    color: 'var(--status-ready)'
  },
  cancelled: {
    background: 'var(--status-cancelled-soft)',
    color: 'var(--status-cancelled)'
  }
};

/** Small status pill. */
function Badge({
  tone = 'neutral',
  dot = false,
  children,
  style
}) {
  const t = BADGE_TONES[tone] || BADGE_TONES.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 24,
      padding: '0 10px',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-bold)',
      whiteSpace: 'nowrap',
      ...t,
      ...style
    }
  }, dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 999,
      background: 'currentColor',
      flexShrink: 0
    }
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
/** Surface container — white, 16px radius, soft shadow. */
function Card({
  padding = 'var(--card-pad)',
  pressable = false,
  onClick,
  children,
  style
}) {
  const [press, setPress] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseDown: pressable ? () => setPress(true) : undefined,
    onMouseUp: pressable ? () => setPress(false) : undefined,
    onMouseLeave: pressable ? () => setPress(false) : undefined,
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--border-default)',
      padding,
      cursor: pressable ? 'pointer' : undefined,
      transform: press ? 'scale(0.985)' : 'none',
      transition: 'transform var(--duration-fast) var(--ease-out)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
/* Lucide icon path data (ISC license, lucide.dev) — copied, not hand-drawn.
   Stroke style: 2px, round caps/joins, 24x24 viewBox. */
const P = d => ['path', {
  d
}];
const ICONS = {
  'search': [['circle', {
    cx: 11,
    cy: 11,
    r: 8
  }], P('m21 21-4.3-4.3')],
  'map-pin': [P('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'), ['circle', {
    cx: 12,
    cy: 10,
    r: 3
  }]],
  'star': [['polygon', {
    points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'
  }]],
  'calendar': [P('M8 2v4'), P('M16 2v4'), ['rect', {
    width: 18,
    height: 18,
    x: 3,
    y: 4,
    rx: 2
  }], P('M3 10h18')],
  'file-text': [P('M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'), P('M14 2v4a2 2 0 0 0 2 2h4'), P('M10 9H8'), P('M16 13H8'), P('M16 17H8')],
  'home': [P('m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'), ['polyline', {
    points: '9 22 9 12 15 12 15 22'
  }]],
  'flask': [P('M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2'), P('M8.5 2h7'), P('M7 16.5h10')],
  'user': [P('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'), ['circle', {
    cx: 12,
    cy: 7,
    r: 4
  }]],
  'bell': [P('M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'), P('M10.3 21a1.94 1.94 0 0 0 3.4 0')],
  'chevron-right': [P('m9 18 6-6-6-6')],
  'chevron-left': [P('m15 18-6-6 6-6')],
  'chevron-down': [P('m6 9 6 6 6-6')],
  'download': [P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), ['polyline', {
    points: '7 10 12 15 17 10'
  }], ['line', {
    x1: 12,
    x2: 12,
    y1: 15,
    y2: 3
  }]],
  'check': [P('M20 6 9 17l-5-5')],
  'clock': [['circle', {
    cx: 12,
    cy: 12,
    r: 10
  }], ['polyline', {
    points: '12 6 12 12 16 14'
  }]],
  'x': [P('M18 6 6 18'), P('m6 6 12 12')],
  'plus': [P('M5 12h14'), P('M12 5v14')],
  'sliders': [['line', {
    x1: 21,
    x2: 14,
    y1: 4,
    y2: 4
  }], ['line', {
    x1: 10,
    x2: 3,
    y1: 4,
    y2: 4
  }], ['line', {
    x1: 21,
    x2: 12,
    y1: 12,
    y2: 12
  }], ['line', {
    x1: 8,
    x2: 3,
    y1: 12,
    y2: 12
  }], ['line', {
    x1: 21,
    x2: 16,
    y1: 20,
    y2: 20
  }], ['line', {
    x1: 12,
    x2: 3,
    y1: 20,
    y2: 20
  }], ['line', {
    x1: 14,
    x2: 14,
    y1: 2,
    y2: 6
  }], ['line', {
    x1: 8,
    x2: 8,
    y1: 10,
    y2: 14
  }], ['line', {
    x1: 16,
    x2: 16,
    y1: 18,
    y2: 22
  }]],
  'droplet': [P('M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z')],
  'arrow-right': [P('M5 12h14'), P('m12 5 7 7-7 7')],
  'shield-check': [P('M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'), P('m9 12 2 2 4-4')],
  'navigation': [['polygon', {
    points: '3 11 22 2 13 21 11 13 3 11'
  }]],
  'credit-card': [['rect', {
    width: 20,
    height: 14,
    x: 2,
    y: 5,
    rx: 2
  }], ['line', {
    x1: 2,
    x2: 22,
    y1: 10,
    y2: 10
  }]],
  'phone': [P('M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z')],
  'repeat': [P('m17 2 4 4-4 4'), P('M3 11v-1a4 4 0 0 1 4-4h14'), P('m7 22-4-4 4-4'), P('M21 13v1a4 4 0 0 1-4 4H3')]
};
function Icon({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
  style
}) {
  const parts = ICONS[name] || [];
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0,
      ...style
    },
    "aria-hidden": "true"
  }, parts.map(([tag, attrs], i) => React.createElement(tag, {
    key: i,
    ...attrs
  })));
}
const ICON_NAMES = Object.keys(ICONS);
Object.assign(__ds_scope, { Icon, ICON_NAMES });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const BTN_VARIANTS = {
  primary: {
    background: 'var(--teal-500)',
    color: 'var(--text-on-brand)',
    border: '1px solid transparent'
  },
  secondary: {
    background: 'var(--surface-brand-soft)',
    color: 'var(--teal-700)',
    border: '1px solid var(--teal-200)'
  },
  outline: {
    background: 'var(--surface-card)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-strong)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--teal-600)',
    border: '1px solid transparent'
  },
  danger: {
    background: 'var(--danger-500)',
    color: '#FFFFFF',
    border: '1px solid transparent'
  }
};
const BTN_HOVER = {
  primary: {
    background: 'var(--teal-600)'
  },
  secondary: {
    background: 'var(--teal-100)'
  },
  outline: {
    background: 'var(--surface-sunken)'
  },
  ghost: {
    background: 'var(--surface-brand-soft)'
  },
  danger: {
    background: '#B83330'
  }
};
const BTN_SIZES = {
  sm: {
    height: 'var(--control-h-sm)',
    padding: '0 14px',
    fontSize: 'var(--text-sm)',
    gap: 6,
    iconSize: 16
  },
  md: {
    height: 'var(--control-h-md)',
    padding: '0 18px',
    fontSize: 'var(--text-base)',
    gap: 8,
    iconSize: 18
  },
  lg: {
    height: 'var(--control-h-lg)',
    padding: '0 22px',
    fontSize: 'var(--text-md)',
    gap: 8,
    iconSize: 20
  }
};

/** Primary action control. */
function Button({
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  disabled = false,
  children,
  style,
  onClick,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.primary;
  const s = BTN_SIZES[size] || BTN_SIZES.md;
  return /*#__PURE__*/React.createElement("button", _extends({
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    disabled: disabled,
    style: {
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
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.iconSize
  }) : null, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
/** Selectable filter chip. */
function Chip({
  selected = false,
  icon,
  onClick,
  children,
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 36,
      padding: '0 14px',
      borderRadius: 'var(--radius-full)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-semibold)',
      fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      background: selected ? 'var(--teal-500)' : hover ? 'var(--surface-sunken)' : 'var(--surface-card)',
      color: selected ? '#fff' : 'var(--neutral-700)',
      border: selected ? '1px solid var(--teal-500)' : '1px solid var(--border-strong)',
      transition: 'background var(--duration-fast) var(--ease-out)',
      ...style
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 15
  }) : null, children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const IB_VARIANTS = {
  subtle: {
    background: 'var(--surface-sunken)',
    color: 'var(--neutral-700)',
    border: '1px solid transparent'
  },
  outline: {
    background: 'var(--surface-card)',
    color: 'var(--neutral-700)',
    border: '1px solid var(--border-strong)'
  },
  brand: {
    background: 'var(--teal-500)',
    color: '#FFFFFF',
    border: '1px solid transparent'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--neutral-600)',
    border: '1px solid transparent'
  }
};

/** Square icon-only button (44px hit target). */
function IconButton({
  icon,
  variant = 'subtle',
  size = 44,
  label,
  disabled = false,
  style,
  onClick,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const v = IB_VARIANTS[variant] || IB_VARIANTS.subtle;
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label || icon,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    disabled: disabled,
    style: {
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
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: Math.round(size * 0.45)
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/ListRow.jsx
try { (() => {
/** Tappable list row: leading icon tile, title/subtitle, trailing chevron or custom node. */
function ListRow({
  icon,
  iconColor = 'var(--teal-600)',
  title,
  subtitle,
  trailing,
  chevron = true,
  onClick,
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minHeight: 'var(--hit-target)',
      padding: '10px 4px',
      cursor: onClick ? 'pointer' : undefined,
      background: hover && onClick ? 'var(--surface-sunken)' : 'transparent',
      borderRadius: 'var(--radius-sm)',
      transition: 'background var(--duration-fast) var(--ease-out)',
      ...style
    }
  }, icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--radius-md)',
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface-brand-soft)',
      color: iconColor
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18
  })) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--text-primary)'
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)'
    }
  }, subtitle) : null), trailing, chevron && onClick ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 18,
    color: "var(--text-muted)"
  }) : null);
}
Object.assign(__ds_scope, { ListRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ListRow.jsx", error: String((e && e.message) || e) }); }

// components/core/Logo.jsx
try { (() => {
/** Labzy wordmark lockup: "LAB" teal + "ZY" charcoal, heavy italic. */
function Logo({
  size = 24,
  tone = 'default',
  style
}) {
  const lab = tone === 'white' ? '#FFFFFF' : 'var(--teal-500)';
  const zy = tone === 'white' ? 'rgba(255,255,255,0.72)' : 'var(--logo-charcoal)';
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-logo)',
      fontStyle: 'italic',
      fontWeight: 800,
      fontSize: size,
      letterSpacing: '-0.01em',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      userSelect: 'none',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: lab
    }
  }, "LAB"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: zy
    }
  }, "ZY"));
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Logo.jsx", error: String((e && e.message) || e) }); }

// components/domain/LabCard.jsx
try { (() => {
/** Lab listing card — discovery results. */
function LabCard({
  name,
  rating,
  reviews,
  distance,
  eta,
  verified = true,
  homeCollection = true,
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pressable: !!onClick,
    onClick: onClick,
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: name,
    size: 46
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-primary)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, name), verified ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "shield-check",
    size: 16,
    color: "var(--teal-500)"
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-primary)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "star",
    size: 13,
    color: "var(--warning-500)",
    style: {
      fill: 'var(--warning-500)'
    }
  }), rating), reviews ? /*#__PURE__*/React.createElement("span", null, "(", reviews, ")") : null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "navigation",
    size: 12
  }), distance)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, homeCollection ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "brand"
  }, "Home collection") : null, eta ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "neutral"
  }, eta) : null)), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 18,
    color: "var(--text-muted)",
    style: {
      alignSelf: 'center'
    }
  })));
}
Object.assign(__ds_scope, { LabCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/LabCard.jsx", error: String((e && e.message) || e) }); }

// components/domain/ReportRow.jsx
try { (() => {
const REPORT_STATUS = {
  ready: {
    tone: 'ready',
    label: 'Ready'
  },
  processing: {
    tone: 'processing',
    label: 'Processing'
  },
  sampled: {
    tone: 'sampled',
    label: 'Sample collected'
  },
  booked: {
    tone: 'booked',
    label: 'Booked'
  },
  cancelled: {
    tone: 'cancelled',
    label: 'Cancelled'
  }
};

/** Report list row — test name, lab, date, status; download when ready. */
function ReportRow({
  name,
  lab,
  date,
  status = 'ready',
  onOpen,
  onDownload,
  style
}) {
  const [hover, setHover] = React.useState(false);
  const st = REPORT_STATUS[status] || REPORT_STATUS.ready;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onOpen,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      background: hover && onOpen ? 'var(--surface-sunken)' : 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-default)',
      cursor: onOpen ? 'pointer' : undefined,
      transition: 'background var(--duration-fast) var(--ease-out)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--radius-md)',
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: status === 'ready' ? 'var(--status-ready-soft)' : 'var(--surface-sunken)',
      color: status === 'ready' ? 'var(--status-ready)' : 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "file-text",
    size: 19
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-primary)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)'
    }
  }, lab, date ? ` · ${date}` : '')), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: st.tone,
    dot: true
  }, st.label), status === 'ready' && onDownload ? /*#__PURE__*/React.createElement("button", {
    "aria-label": "Download report",
    onClick: e => {
      e.stopPropagation();
      onDownload();
    },
    style: {
      width: 38,
      height: 38,
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      border: '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--teal-600)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "download",
    size: 17
  })) : null);
}
Object.assign(__ds_scope, { ReportRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/ReportRow.jsx", error: String((e && e.message) || e) }); }

// components/domain/StatusTimeline.jsx
try { (() => {
const TIMELINE_STEPS = [{
  key: 'booked',
  label: 'Booked',
  icon: 'calendar'
}, {
  key: 'sampled',
  label: 'Sampled',
  icon: 'droplet'
}, {
  key: 'processing',
  label: 'Processing',
  icon: 'flask'
}, {
  key: 'ready',
  label: 'Report ready',
  icon: 'file-text'
}];

/** Horizontal booking progress timeline. current: index 0–3. */
function StatusTimeline({
  current = 0,
  steps = TIMELINE_STEPS,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      ...style
    }
  }, steps.map((step, i) => {
    const done = i < current;
    const active = i === current;
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: step.key
    }, i > 0 ? /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        height: 3,
        marginTop: 16,
        borderRadius: 2,
        background: i <= current ? 'var(--teal-500)' : 'var(--neutral-100)',
        transition: 'background var(--duration-slow) var(--ease-out)'
      }
    }) : null, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        width: 64,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 34,
        height: 34,
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: done || active ? 'var(--teal-500)' : 'var(--surface-sunken)',
        color: done || active ? '#fff' : 'var(--neutral-400)',
        boxShadow: active ? 'var(--focus-ring)' : 'none',
        transition: 'all var(--duration-base) var(--ease-out)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: done ? 'check' : step.icon,
      size: 16
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-xs)',
        textAlign: 'center',
        lineHeight: 1.25,
        fontWeight: active ? 'var(--weight-bold)' : 'var(--weight-medium)',
        color: active ? 'var(--teal-700)' : done ? 'var(--text-secondary)' : 'var(--text-muted)'
      }
    }, step.label)));
  }));
}
Object.assign(__ds_scope, { StatusTimeline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/StatusTimeline.jsx", error: String((e && e.message) || e) }); }

// components/domain/TestCard.jsx
try { (() => {
/** Diagnostic test / package card with price and add action. */
function TestCard({
  name,
  description,
  price,
  mrp,
  fasting = false,
  reportEta,
  added = false,
  onAdd,
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    pressable: !!onClick,
    onClick: onClick,
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 'var(--radius-md)',
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface-brand-soft)',
      color: 'var(--teal-600)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "flask",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-primary)'
    }
  }, name), description ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)'
    }
  }, description) : null)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--text-muted)'
    }
  }, fasting ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "clock",
    size: 13
  }), "Fasting required") : null, reportEta ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "file-text",
    size: 13
  }), "Report ", reportEta) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--weight-heavy)',
      color: 'var(--text-primary)'
    }
  }, "\u20B9", price), mrp ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      textDecoration: 'line-through'
    }
  }, "\u20B9", mrp) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: added ? 'secondary' : 'primary',
    icon: added ? 'check' : 'plus',
    onClick: e => {
      if (e && e.stopPropagation) e.stopPropagation();
      if (onAdd) onAdd();
    }
  }, added ? 'Added' : 'Add'))));
}
Object.assign(__ds_scope, { TestCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/TestCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
/** Labeled text input with optional leading icon, hint and error. */
function Input({
  label,
  placeholder,
  value,
  onChange,
  icon,
  hint,
  error,
  type = 'text',
  disabled = false,
  style
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-primary)'
    }
  }, label) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      height: 'var(--control-h-md)',
      padding: '0 14px',
      background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
      border: error ? '1.5px solid var(--danger-500)' : focus ? '1.5px solid var(--teal-500)' : '1px solid var(--border-strong)',
      borderRadius: 'var(--radius-md)',
      boxShadow: focus && !error ? 'var(--focus-ring)' : 'none',
      transition: 'border var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)'
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 17,
    color: "var(--text-muted)"
  }) : null, /*#__PURE__*/React.createElement("input", {
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontSize: 'var(--text-base)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)'
    }
  })), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--danger-500)',
      fontWeight: 'var(--weight-medium)'
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchBar.jsx
try { (() => {
/** Rounded search bar — the discovery entry point. */
function SearchBar({
  placeholder = 'Search tests, packages, labs…',
  value,
  onChange,
  onFilter,
  style
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      height: 'var(--control-h-md)',
      padding: '0 16px',
      background: 'var(--surface-card)',
      border: focus ? '1.5px solid var(--teal-500)' : '1px solid var(--border-default)',
      borderRadius: 'var(--radius-full)',
      boxShadow: focus ? 'var(--focus-ring)' : 'var(--shadow-card)',
      transition: 'border var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 18,
    color: focus ? 'var(--teal-600)' : 'var(--text-muted)'
  }), /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontSize: 'var(--text-base)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)'
    }
  })), onFilter ? /*#__PURE__*/React.createElement("button", {
    "aria-label": "Filters",
    onClick: onFilter,
    style: {
      width: 'var(--control-h-md)',
      height: 'var(--control-h-md)',
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--teal-500)',
      color: '#fff',
      border: 'none',
      borderRadius: 'var(--radius-full)',
      cursor: 'pointer',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "sliders",
    size: 18
  })) : null);
}
Object.assign(__ds_scope, { SearchBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchBar.jsx", error: String((e && e.message) || e) }); }

// components/forms/SegmentedControl.jsx
try { (() => {
/** Segmented control — 2–4 mutually exclusive options. */
function SegmentedControl({
  options = [],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      padding: 4,
      background: 'var(--surface-sunken)',
      borderRadius: 'var(--radius-md)',
      ...style
    }
  }, options.map(opt => {
    const key = typeof opt === 'string' ? opt : opt.value;
    const lbl = typeof opt === 'string' ? opt : opt.label;
    const active = key === value;
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      onClick: () => onChange && onChange(key),
      style: {
        flex: 1,
        height: 36,
        padding: '0 12px',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-bold)',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        background: active ? 'var(--surface-card)' : 'transparent',
        color: active ? 'var(--teal-700)' : 'var(--text-secondary)',
        boxShadow: active ? 'var(--shadow-card)' : 'none',
        transition: 'all var(--duration-fast) var(--ease-out)'
      }
    }, lbl);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
/** Toggle switch. */
function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  style
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    role: "switch",
    "aria-checked": checked,
    onClick: disabled ? undefined : () => onChange && onChange(!checked),
    style: {
      width: 48,
      height: 28,
      borderRadius: 'var(--radius-full)',
      flexShrink: 0,
      background: checked ? 'var(--teal-500)' : 'var(--neutral-200)',
      position: 'relative',
      transition: 'background var(--duration-base) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: checked ? 23 : 3,
      width: 22,
      height: 22,
      borderRadius: 999,
      background: '#fff',
      boxShadow: '0 1px 3px rgba(13,38,35,0.25)',
      transition: 'left var(--duration-base) var(--ease-out)'
    }
  })), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-medium)',
      color: 'var(--text-primary)'
    }
  }, label) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
/** Bottom tab bar. items: [{ key, icon, label, badge? }] */
function TabBar({
  items = [],
  active,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-default)',
      padding: '6px 8px 10px',
      ...style
    }
  }, items.map(it => {
    const isActive = it.key === active;
    return /*#__PURE__*/React.createElement("button", {
      key: it.key,
      onClick: () => onChange && onChange(it.key),
      style: {
        flex: 1,
        minHeight: 'var(--hit-target)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: isActive ? 'var(--teal-600)' : 'var(--neutral-400)',
        fontFamily: 'var(--font-sans)',
        transition: 'color var(--duration-fast) var(--ease-out)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'relative',
        display: 'inline-flex'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 22,
      strokeWidth: isActive ? 2.4 : 2
    }), it.badge ? /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: -3,
        right: -7,
        minWidth: 15,
        height: 15,
        padding: '0 4px',
        borderRadius: 999,
        background: 'var(--danger-500)',
        color: '#fff',
        fontSize: 9,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, it.badge) : null), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-xs)',
        fontWeight: isActive ? 'var(--weight-bold)' : 'var(--weight-medium)'
      }
    }, it.label));
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
/** Mobile top app bar: back button, title/subtitle, trailing action. */
function TopBar({
  title,
  subtitle,
  onBack,
  action,
  transparent = false,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      height: 56,
      padding: '0 var(--screen-pad-x)',
      background: transparent ? 'transparent' : 'var(--surface-page)',
      ...style
    }
  }, onBack ? /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "chevron-left",
    variant: "ghost",
    size: 40,
    label: "Back",
    onClick: onBack,
    style: {
      marginLeft: -10
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--weight-heavy)',
      color: 'var(--text-primary)',
      letterSpacing: 'var(--tracking-tight)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-secondary)'
    }
  }, subtitle) : null), action);
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/partner_app/PartnerOrders.jsx
try { (() => {
const STAGE_FLOW = ['booked', 'sampled', 'processing', 'ready'];
const STAGE_META = {
  booked: {
    tone: 'booked',
    label: 'Booked',
    action: 'Mark sample collected',
    icon: 'droplet'
  },
  sampled: {
    tone: 'sampled',
    label: 'Sample collected',
    action: 'Start processing',
    icon: 'flask'
  },
  processing: {
    tone: 'processing',
    label: 'Processing',
    action: 'Upload report',
    icon: 'file-text'
  },
  ready: {
    tone: 'ready',
    label: 'Report sent',
    action: null,
    icon: null
  }
};
function PartnerOrders({
  orders = [],
  onAdvance
}) {
  const [filter, setFilter] = React.useState('Active');
  const visible = filter === 'Active' ? orders.filter(o => o.stage !== 'ready') : orders;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.TopBar, {
    title: "Today's orders",
    subtitle: "Thu 12 Jun"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: '4px var(--screen-pad-x) 24px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SegmentedControl, {
    options: ['Active', 'All'],
    value: filter,
    onChange: setFilter
  }), visible.map(o => {
    const meta = STAGE_META[o.stage];
    return /*#__PURE__*/React.createElement(__ds_scope.Card, {
      key: o.id
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-base)',
        fontWeight: 'var(--weight-bold)'
      }
    }, o.patient), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-sm)',
        color: 'var(--text-secondary)'
      }
    }, o.tests), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)'
      }
    }, o.id, " \xB7 ", o.slot)), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
      tone: meta.tone,
      dot: true
    }, meta.label)), meta.action ? /*#__PURE__*/React.createElement(__ds_scope.Button, {
      variant: o.stage === 'processing' ? 'primary' : 'secondary',
      size: "sm",
      icon: meta.icon,
      onClick: () => onAdvance && onAdvance(o.id)
    }, meta.action) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-sm)',
        color: 'var(--success-500)',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "check",
      size: 15
    }), "Delivered to patient")));
  })));
}
Object.assign(__ds_scope, { PartnerOrders, STAGE_FLOW });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/partner_app/PartnerOrders.jsx", error: String((e && e.message) || e) }); }

// ui_kits/partner_app/PartnerToday.jsx
try { (() => {
const TODAY_STATS = [{
  label: 'Bookings',
  value: '18'
}, {
  label: 'Home visits',
  value: '11'
}, {
  label: 'Reports due',
  value: '6'
}];
function PartnerToday({
  requests = [],
  onAccept,
  onDecline
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      padding: '12px var(--screen-pad-x) 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)',
      fontWeight: 600
    }
  }, "HealthFirst Diagnostics \xB7 Partner")), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "bell",
    variant: "outline",
    size: 42,
    label: "Notifications"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 10
    }
  }, TODAY_STATS.map(s => /*#__PURE__*/React.createElement(__ds_scope.Card, {
    key: s.label,
    padding: "12px 14px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-2xl)',
      fontWeight: 'var(--weight-heavy)',
      fontFamily: 'var(--font-mono)'
    }
  }, s.value), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, s.label))))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--weight-bold)',
      flex: 1
    }
  }, "Incoming requests"), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "booked",
    dot: true
  }, requests.length, " new")), requests.length === 0 ? /*#__PURE__*/React.createElement(__ds_scope.Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: '16px 0',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 22,
    color: "var(--success-500)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600
    }
  }, "All caught up"))) : requests.map(r => /*#__PURE__*/React.createElement(__ds_scope.Card, {
    key: r.id
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: r.patient,
    size: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-bold)'
    }
  }, r.patient), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)'
    }
  }, r.tests), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: r.mode === 'Home collection' ? 'map-pin' : 'clock',
    size: 12
  }), r.mode, " \xB7 ", r.slot)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 800
    }
  }, "\u20B9", r.amount)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "outline",
    size: "sm",
    style: {
      flex: 1
    },
    onClick: () => onDecline && onDecline(r.id)
  }, "Decline"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    icon: "check",
    style: {
      flex: 2
    },
    onClick: () => onAccept && onAccept(r.id)
  }, "Accept")))))));
}
Object.assign(__ds_scope, { PartnerToday });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/partner_app/PartnerToday.jsx", error: String((e && e.message) || e) }); }

// ui_kits/patient_app/PatientBookings.jsx
try { (() => {
function PatientBookings({
  justBooked = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.TopBar, {
    title: "Your bookings"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: '4px var(--screen-pad-x) 24px'
    }
  }, justBooked ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 14px',
      background: 'var(--success-soft)',
      borderRadius: 'var(--radius-md)',
      color: 'var(--success-500)',
      fontSize: 'var(--text-sm)',
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 17
  }), "Booking confirmed \u2014 we've texted the details") : null, /*#__PURE__*/React.createElement(__ds_scope.Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--weight-bold)'
    }
  }, "Lipid Profile + CBC"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)'
    }
  }, "HealthFirst Diagnostics \xB7 Home collection"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, "LBZ-48291")), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "processing",
    dot: true
  }, "Processing")), /*#__PURE__*/React.createElement(__ds_scope.StatusTimeline, {
    current: 2
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      padding: '10px 12px',
      background: 'var(--surface-sunken)',
      borderRadius: 'var(--radius-md)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "clock",
    size: 16,
    color: "var(--teal-600)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)',
      flex: 1
    }
  }, "Report expected by ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--text-primary)'
    }
  }, "2:00 PM today"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "outline",
    size: "sm",
    icon: "phone",
    style: {
      flex: 1
    }
  }, "Call lab"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    size: "sm",
    icon: "file-text",
    style: {
      flex: 1
    }
  }, "View tests")))), /*#__PURE__*/React.createElement(__ds_scope.Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--weight-bold)'
    }
  }, "HbA1c \u2014 quarterly re-test"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)'
    }
  }, "CityLab Pathology \xB7 Walk-in"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, "LBZ-48104 \xB7 Sat 14 Jun, 8:30 AM")), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "booked",
    dot: true
  }, "Booked")), /*#__PURE__*/React.createElement(__ds_scope.StatusTimeline, {
    current: 0
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "outline",
    size: "sm",
    icon: "calendar",
    style: {
      flex: 1
    }
  }, "Reschedule"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "ghost",
    size: "sm",
    icon: "x",
    style: {
      flex: 1
    }
  }, "Cancel"))))));
}
Object.assign(__ds_scope, { PatientBookings });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/patient_app/PatientBookings.jsx", error: String((e && e.message) || e) }); }

// ui_kits/patient_app/PatientHome.jsx
try { (() => {
const HOME_CATEGORIES = [{
  key: 'blood',
  icon: 'droplet',
  label: 'Blood'
}, {
  key: 'fullbody',
  icon: 'shield-check',
  label: 'Full body'
}, {
  key: 'thyroid',
  icon: 'flask',
  label: 'Thyroid'
}, {
  key: 'diabetes',
  icon: 'clock',
  label: 'Diabetes'
}];
function PatientHome({
  onOpenLab,
  cart = {},
  onToggleTest
}) {
  const [cat, setCat] = React.useState('blood');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      padding: '12px var(--screen-pad-x) 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    size: 22
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "map-pin",
    size: 13
  }), "Indiranagar, Bengaluru")), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "bell",
    variant: "outline",
    size: 42,
    label: "Notifications"
  })), /*#__PURE__*/React.createElement(__ds_scope.SearchBar, {
    onFilter: () => {}
  }), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    style: {
      background: 'var(--teal-800)',
      border: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "ready",
    dot: true,
    style: {
      alignSelf: 'flex-start'
    }
  }, "Report ready"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: '#fff',
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--weight-bold)'
    }
  }, "Lipid Profile \u2014 HealthFirst"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--teal-200)',
      fontSize: 'var(--text-sm)'
    }
  }, "Collected yesterday \xB7 7:20 AM")), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--radius-md)',
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(255,255,255,0.14)',
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "download",
    size: 19
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      paddingBottom: 2
    }
  }, HOME_CATEGORIES.map(c => /*#__PURE__*/React.createElement(__ds_scope.Chip, {
    key: c.key,
    icon: c.icon,
    selected: cat === c.key,
    onClick: () => setCat(c.key)
  }, c.label))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--weight-bold)',
      flex: 1
    }
  }, "Labs near you"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--teal-600)'
    }
  }, "See all")), /*#__PURE__*/React.createElement(__ds_scope.LabCard, {
    name: "HealthFirst Diagnostics",
    rating: 4.8,
    reviews: "1.2k",
    distance: "0.8 km",
    eta: "Reports in 6h",
    onClick: () => onOpenLab && onOpenLab('healthfirst')
  }), /*#__PURE__*/React.createElement(__ds_scope.LabCard, {
    name: "CityLab Pathology",
    rating: 4.6,
    reviews: "860",
    distance: "1.4 km",
    eta: "Reports in 12h",
    onClick: () => onOpenLab && onOpenLab('citylab')
  })), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--weight-bold)'
    }
  }, "Popular tests"), /*#__PURE__*/React.createElement(__ds_scope.TestCard, {
    name: "Complete Blood Count",
    description: "26 parameters \xB7 whole blood",
    price: 299,
    mrp: 450,
    fasting: true,
    reportEta: "in 6 hrs",
    added: !!cart.cbc,
    onAdd: () => onToggleTest && onToggleTest('cbc')
  }), /*#__PURE__*/React.createElement(__ds_scope.TestCard, {
    name: "HbA1c (Glycated Hb)",
    description: "3-month sugar average",
    price: 449,
    reportEta: "in 8 hrs",
    added: !!cart.hba1c,
    onAdd: () => onToggleTest && onToggleTest('hba1c')
  })));
}
Object.assign(__ds_scope, { PatientHome });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/patient_app/PatientHome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/patient_app/PatientLabDetail.jsx
try { (() => {
const SLOT_DATES = [{
  key: 'today',
  day: 'Thu',
  date: '12'
}, {
  key: 'fri',
  day: 'Fri',
  date: '13'
}, {
  key: 'sat',
  day: 'Sat',
  date: '14'
}, {
  key: 'sun',
  day: 'Sun',
  date: '15'
}];
const SLOT_TIMES = ['6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM'];
function PatientLabDetail({
  onBack,
  onBook,
  cart = {},
  onToggleTest
}) {
  const [mode, setMode] = React.useState('Home collection');
  const [date, setDate] = React.useState('today');
  const [time, setTime] = React.useState('7:00 AM');
  const count = Object.values(cart).filter(Boolean).length;
  const total = (cart.cbc ? 299 : 0) + (cart.hba1c ? 449 : 0) + (cart.lipid ? 549 : 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.TopBar, {
    title: "HealthFirst Diagnostics",
    onBack: onBack,
    action: /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
      icon: "phone",
      size: 40,
      variant: "ghost",
      label: "Call lab"
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      padding: '4px var(--screen-pad-x) 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: "HealthFirst Diagnostics",
    size: 52
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--weight-heavy)'
    }
  }, "HealthFirst Diagnostics"), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "shield-check",
    size: 16,
    color: "var(--teal-500)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      fontSize: 'var(--text-sm)',
      color: 'var(--text-secondary)',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-primary)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "star",
    size: 13,
    color: "var(--warning-500)"
  }), "4.8"), /*#__PURE__*/React.createElement("span", null, "0.8 km \xB7 Indiranagar")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "brand"
  }, "NABL accredited"), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "neutral"
  }, "Since 2014")))), /*#__PURE__*/React.createElement(__ds_scope.SegmentedControl, {
    options: ['Home collection', 'Walk-in'],
    value: mode,
    onChange: setMode
  }), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-bold)'
    }
  }, "Pick a date"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, SLOT_DATES.map(d => {
    const active = date === d.key;
    return /*#__PURE__*/React.createElement("button", {
      key: d.key,
      onClick: () => setDate(d.key),
      style: {
        flex: 1,
        height: 62,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        background: active ? 'var(--teal-500)' : 'var(--surface-card)',
        color: active ? '#fff' : 'var(--text-primary)',
        border: active ? '1px solid var(--teal-500)' : '1px solid var(--border-strong)',
        fontFamily: 'var(--font-sans)',
        transition: 'all var(--duration-fast) var(--ease-out)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        opacity: active ? 0.85 : 0.6
      }
    }, d.day), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-md)',
        fontWeight: 800
      }
    }, d.date));
  }))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-bold)'
    }
  }, "Time slot"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8
    }
  }, SLOT_TIMES.map(t => {
    const active = time === t;
    return /*#__PURE__*/React.createElement("button", {
      key: t,
      onClick: () => setTime(t),
      style: {
        height: 40,
        borderRadius: 'var(--radius-full)',
        cursor: 'pointer',
        fontSize: 'var(--text-sm)',
        fontWeight: 700,
        fontFamily: 'var(--font-sans)',
        background: active ? 'var(--surface-brand-soft)' : 'var(--surface-card)',
        color: active ? 'var(--teal-700)' : 'var(--text-secondary)',
        border: active ? '1.5px solid var(--teal-500)' : '1px solid var(--border-strong)',
        transition: 'all var(--duration-fast) var(--ease-out)'
      }
    }, t);
  }))), /*#__PURE__*/React.createElement("section", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--weight-bold)'
    }
  }, "Add tests"), /*#__PURE__*/React.createElement(__ds_scope.TestCard, {
    name: "Lipid Profile",
    description: "8 parameters \xB7 fasting serum",
    price: 549,
    mrp: 700,
    fasting: true,
    reportEta: "in 6 hrs",
    added: !!cart.lipid,
    onAdd: () => onToggleTest && onToggleTest('lipid')
  }), /*#__PURE__*/React.createElement(__ds_scope.TestCard, {
    name: "Complete Blood Count",
    description: "26 parameters \xB7 whole blood",
    price: 299,
    mrp: 450,
    reportEta: "in 6 hrs",
    added: !!cart.cbc,
    onAdd: () => onToggleTest && onToggleTest('cbc')
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      bottom: 0,
      padding: '12px var(--screen-pad-x) 16px',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-secondary)',
      fontWeight: 600
    }
  }, count, " test", count === 1 ? '' : 's'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 800
    }
  }, "\u20B9", total)), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "lg",
    icon: "calendar",
    fullWidth: true,
    disabled: count === 0,
    onClick: onBook,
    style: {
      flex: 1
    }
  }, "Book ", time)));
}
Object.assign(__ds_scope, { PatientLabDetail });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/patient_app/PatientLabDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/patient_app/PatientReports.jsx
try { (() => {
const REPORT_VALUES = [{
  name: 'Total cholesterol',
  value: '186 mg/dL',
  range: '< 200',
  flag: null
}, {
  name: 'LDL',
  value: '128 mg/dL',
  range: '< 100',
  flag: 'high'
}, {
  name: 'HDL',
  value: '52 mg/dL',
  range: '> 40',
  flag: null
}, {
  name: 'Triglycerides',
  value: '142 mg/dL',
  range: '< 150',
  flag: null
}];
function PatientReports() {
  const [filter, setFilter] = React.useState('All');
  const [open, setOpen] = React.useState(true);
  const [remind, setRemind] = React.useState(true);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.TopBar, {
    title: "Reports",
    action: /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
      icon: "search",
      size: 40,
      variant: "ghost",
      label: "Search reports"
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: '4px var(--screen-pad-x) 24px'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SegmentedControl, {
    options: ['All', 'Ready', 'Pending'],
    value: filter,
    onChange: setFilter
  }), /*#__PURE__*/React.createElement(__ds_scope.ReportRow, {
    name: "Lipid Profile",
    lab: "HealthFirst",
    date: "12 Jun",
    status: "ready",
    onOpen: () => setOpen(!open),
    onDownload: () => {}
  }), open ? /*#__PURE__*/React.createElement(__ds_scope.Card, {
    style: {
      marginTop: -6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto auto',
      gap: '8px 18px',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-overline)',
      color: 'var(--text-muted)'
    }
  }, "Parameter"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-overline)',
      color: 'var(--text-muted)',
      textAlign: 'right'
    }
  }, "Value"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-overline)',
      color: 'var(--text-muted)',
      textAlign: 'right'
    }
  }, "Range"), REPORT_VALUES.map(r => /*#__PURE__*/React.createElement(React.Fragment, {
    key: r.name
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600
    }
  }, r.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      textAlign: 'right',
      color: r.flag ? 'var(--danger-500)' : 'var(--text-primary)'
    }
  }, r.value, r.flag ? ' ↑' : ''), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      textAlign: 'right'
    }
  }, r.range)))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-default)',
      paddingTop: 12
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Switch, {
    checked: remind,
    onChange: setRemind,
    label: "Remind me to re-test in 3 months"
  })))) : null, /*#__PURE__*/React.createElement(__ds_scope.ReportRow, {
    name: "HbA1c",
    lab: "CityLab",
    date: "Today",
    status: "processing",
    onOpen: () => {}
  }), /*#__PURE__*/React.createElement(__ds_scope.ReportRow, {
    name: "Complete Blood Count",
    lab: "HealthFirst",
    date: "28 May",
    status: "ready",
    onOpen: () => {},
    onDownload: () => {}
  }), /*#__PURE__*/React.createElement(__ds_scope.ReportRow, {
    name: "Vitamin D, 25-OH",
    lab: "CityLab",
    date: "3 Apr",
    status: "ready",
    onOpen: () => {},
    onDownload: () => {}
  })));
}
Object.assign(__ds_scope, { PatientReports });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/patient_app/PatientReports.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.ICON_NAMES = __ds_scope.ICON_NAMES;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.ListRow = __ds_scope.ListRow;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.LabCard = __ds_scope.LabCard;

__ds_ns.ReportRow = __ds_scope.ReportRow;

__ds_ns.StatusTimeline = __ds_scope.StatusTimeline;

__ds_ns.TestCard = __ds_scope.TestCard;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.SearchBar = __ds_scope.SearchBar;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.TopBar = __ds_scope.TopBar;

__ds_ns.PartnerOrders = __ds_scope.PartnerOrders;

__ds_ns.STAGE_FLOW = __ds_scope.STAGE_FLOW;

__ds_ns.PartnerToday = __ds_scope.PartnerToday;

__ds_ns.PatientBookings = __ds_scope.PatientBookings;

__ds_ns.PatientHome = __ds_scope.PatientHome;

__ds_ns.PatientLabDetail = __ds_scope.PatientLabDetail;

__ds_ns.PatientReports = __ds_scope.PatientReports;

})();
