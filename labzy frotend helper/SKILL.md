---
name: labzy-design
description: Use this skill to generate well-branded interfaces and assets for Labzy — a dual-platform mobile product connecting patients with verified diagnostic labs. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the Customer App and Partner App.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick brand guide

**Brand teal:** `#149584` (`--teal-500`) — the single action color; use for primary buttons, active tabs, key icons.
**Logo charcoal:** `#454545` — secondary brand color; headings, body text when on-brand surfaces are needed.
**Type:** Manrope (UI); IBM Plex Mono (data / test values); Montserrat ExtraBold Italic (wordmark only).
**Icons:** Lucide line icons, 2px stroke, round caps — no emoji, no hand-drawn SVG.
**Tone:** Clear, calm, never alarmist. Sentence case. No jargon. Reassure, don't push.
**No:** gradients, decorative animations, colored left-border cards, bounce/spring easing.

## Key product flows (Customer App)

1. Onboarding → phone + OTP, consent, location
2. Discovery → nearby labs list, filter/search by test name
3. Lab detail → test catalog, price, TAT, reviews
4. Booking → mode (home/walk-in) → date/slot → patient → pay → confirmed
5. Recurring booking → set frequency, auto-pay or approve-each-time, pre-booking reminder
6. Sample collection → assistant assigned, OTP verification
7. Reports → notification → open → value table → download/share → re-test reminder

## Key product flows (Partner App)

1. Today → stats summary, incoming requests (accept/decline within 2 hrs)
2. Orders → advance status (Booked → Sampled → Processing → Report ready)
3. Staff → assign assistants to home-collection bookings
4. Report upload → confirm patient match → publish → customer notified
5. Dashboard → revenue, TAT compliance, ratings

## Files to reference

- `readme.md` — full design guide (tone, visual foundations, iconography)
- `styles.css` → `tokens/` — all CSS custom properties
- `components/core/` — Button, Badge, Card, Avatar, Chip, ListRow, Logo, Icon
- `components/forms/` — Input, SearchBar, Switch, SegmentedControl
- `components/navigation/` — TopBar, TabBar
- `components/domain/` — LabCard, TestCard, ReportRow, StatusTimeline
- `ui_kits/patient_app/index.html` — interactive patient app prototype
- `ui_kits/partner_app/index.html` — interactive partner app prototype
- `assets/brand/` — logo PNGs (white, transparent, original)
