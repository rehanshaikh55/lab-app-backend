# Labzy Patient app — UI kit

Interactive recreation of the patient-side mobile app (390px design width).

**Flow demonstrated in `index.html`:** Home (discover labs & tests) → tap a lab → Lab detail (pick mode, date, slot, add tests) → Book → Bookings tab (status timeline) · Reports tab (list + inline result values) · Profile.

**Screens**
- `PatientHome.jsx` — greeting + location, search, report-ready banner (dark teal), category chips, lab cards, popular tests.
- `PatientLabDetail.jsx` — lab header, Home collection/Walk-in segmented control, date & time slot pickers, test cart, sticky bottom CTA with total.
- `PatientBookings.jsx` — booking cards with `StatusTimeline`, expected-by note, reschedule/cancel actions.
- `PatientReports.jsx` — filter segmented control, `ReportRow` list, expanded report with mono value/range table and a re-test reminder switch.

All screens compose the shared components — no UI is re-implemented here.

> NOTE: This kit was designed from the brand logo + product description only (no source app was provided). Treat the layouts as a proposed canonical look, not a recreation.
