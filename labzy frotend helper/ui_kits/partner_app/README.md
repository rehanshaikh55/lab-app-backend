# Labzy Partner app — UI kit

Interactive recreation of the lab-side partner app (390px design width).

**Personas:** Lab Owner (Dr. Mehta), Lab Manager (Priya), Lab Assistant (Arjun) — see PRD §4.2.

**Screens in `index.html`:**
- `PartnerToday.jsx` — logo header, today's stat summary (18 bookings / 11 home visits / 6 reports due), incoming request cards with Accept/Decline.
- `PartnerOrders.jsx` — chronological order list with Active/All filter; advance booking status (Booked → Sampled → Processing → Report ready) with one tap.
- Staff screen — assistant roster with visit count and Active/Inactive status.
- Settings screen — test catalog, slot setup, certifications, notifications, earnings/ratings list.

**Key flows demonstrated:**
- Accept a request → it moves from Today > Incoming to Orders list
- Advance an order through the status pipeline
- Tab badge reflects pending incoming count

> Source: PRD v2.0 (10 Jun 2026). No partner app code or Figma was provided — this is a proposed canonical look designed to the PRD requirements.
