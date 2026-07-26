Bottom tab bar — active tab is teal with a heavier stroke; supports badge counts.

```jsx
<TabBar
  items={[
    { key: 'home', icon: 'home', label: 'Home' },
    { key: 'bookings', icon: 'calendar', label: 'Bookings' },
    { key: 'reports', icon: 'file-text', label: 'Reports', badge: 2 },
    { key: 'profile', icon: 'user', label: 'Profile' },
  ]}
  active={tab} onChange={setTab}
/>
```
