# Labzy Design System

**Labzy** is a dual-platform mobile product that connects people who need diagnostic tests with verified diagnostic labs in their area. It removes the friction of phone calls, physical visits, paper reports, and forgotten follow-up tests — making the entire journey **discover → book → get sampled → pay → receive report → repeat** digital and effortless.

---

## Products

| App | Audience | Core job |
|---|---|---|
| **Labzy Customer app** | Patients, health-conscious users, caregivers | Discover labs, book tests, get samples collected, receive reports, manage recurring checkups |
| **Labzy Partner app** | Lab owners, managers, assistants | Receive & manage bookings, assign collection staff, upload reports, track performance |

## Sources

- `uploads/10565.jpg` — Labzy wordmark logo (brand teal `#149584`, charcoal `#454545`). Colours sampled programmatically.
- **Labzy PRD v2.0** (10 Jun 2026, author: Rehan Shaikh) — full product spec for both apps; all UX flows reference §§ within it.
- **No source codebase, Figma file, or font binaries were provided.** The token choices, type scale, component designs, and UI kits are original, designed to fit the brand and PRD. They should be treated as a proposed canonical foundation, not a recreation.

---

## CONTENT FUNDAMENTALS

### Tone

**Clear, calm, never alarmist.** This is a health product — test results carry emotional weight. Copy must be:

- **Reassuring, not clinical.** Avoid medical jargon; when a test name is technical, a plain-language description always follows (e.g. *"HbA1c (Glycated Hb) — your 3-month sugar average"*).
- **Confident, not pushy.** CTAs say what will happen ("Book 7:00 AM" not "Book Now!").
- **Concise over clever.** No taglines on functional UI. Wordplay is allowed only in marketing, never in error states.

### Voice

- **First person = "you" for customer, "your lab" for partner.** Never "the user".
- **We** is Labzy (sparingly — interface copy, not a conversational character).
- **Contractions are fine** and warm: "we'll text you" over "you will be texted".
- **No emoji in UI.** Never. The brand is friendly but not playful-emoji-friendly. The exception is explicit rating stars ★ (unicode, not emoji) in data contexts.

### Casing

- **Sentence case everywhere** in UI labels, buttons, error messages, notifications.
- **Title Case** only for screen/section headings (e.g. "Lab Profile", "My Reports").
- **UPPERCASE** only for overline labels (e.g. `TEST NAME · RANGE`), set in `--text-xs` + `--tracking-overline`.
- **Numbers in UI**: rupee amounts always `₹` prefix, no space (`₹1,299`); distances `0.8 km`; ratings `4.8`; booking IDs always in mono (`LBZ-48291`).

### Error messages

Every error state = **what happened + what happens next + what (if anything) the user should do.** Never dead ends. Never "Something went wrong." (PRD §8.4)

Examples:
- ✅ "Your OTP expired. We sent a new one — check your messages."
- ✅ "This slot just filled up. Choose another time or try a different lab."
- ✗ "Error: booking failed."

### Status labels (booking lifecycle)

The canonical status strings used across both apps and all notifications:

`Pending lab confirmation` → `Confirmed` → `Assistant assigned` → `On the way` → `Sample collected` → `Processing` → `Report ready` → `Completed`

Exceptional: `Rescheduled`, `Cancelled by you`, `Cancelled by lab`, `No-show`

---

## VISUAL FOUNDATIONS

### Color

- **One brand color: teal.** `--teal-500` (`#149584`) is the action color — buttons, active states, key icons, active tab indicator. Used purposefully; never decoratively.
- **Surfaces are white or near-white.** Page = `--neutral-25`; cards = `--neutral-0`. No colored backgrounds on screens.
- **Dark teal hero surfaces** (`--teal-800`) appear in one banner per home screen — the "report ready" or "booking confirmed" moment. Never for ambient decoration.
- **Semantic status colors** (info, warning, success, danger) follow the booking lifecycle. Each has a solid variant (text, icons) and a soft tint variant (pill backgrounds). They are never mixed beyond their semantic purpose.
- **No gradients.** Surfaces are flat. The brand energy comes from the bold italic wordmark and confident teal, not decorative gradients.

### Typography

- **Manrope** is the UI face: geometric, friendly, clinical-adjacent. Used for all UI text.
  - Heavy (800) for all headings, screen titles, numeric hero values.
  - SemiBold (600) for list titles, button labels, emphasized body.
  - Medium (500) for captions, secondary info.
  - Regular (400) for long-form body only (report descriptions, legal).
- **IBM Plex Mono** for all data: test values, reference ranges, booking IDs, prices in tables. The mono face signals "precision instrument" — exactly the right register for lab results.
- **Montserrat ExtraBold Italic** for the wordmark CSS lockup only (never UI text).
- *Note: Manrope and Montserrat are Google Fonts substitutions. Request original font files from the brand team.*

### Spacing

- **4px base grid.** All layout distances are multiples of 4.
- **20px screen gutter** (`--screen-pad-x`) on all screens — consistent, never violated.
- **16px card padding** (`--card-pad`) inside all cards.
- **24px section gap** (`--section-gap`) between page sections.

### Corner radii

Generous, warm, non-intimidating — healthcare trust through friendly geometry:
- **6px** — badges, inline chips
- **12px** — buttons, inputs, slot tiles
- **16px** — cards (the primary surface)
- **24px** — bottom sheets, hero panels
- **999px (full pill)** — search bar, FAB, avatar, time-slot selector

### Cards

White surface (`--surface-card`), `--radius-lg` (16px), `--shadow-card` (soft cool-tinted 2-layer shadow), 1px `--border-default` hairline. When tappable: `scale(0.985)` on press, no color change. Never a colored left-border accent.

### Shadows

Cool-tinted (dark teal undertone), never warm. Two levels:
- **Card** — ambient (`0 1px 2px` + `0 4px 12px`) for flat cards
- **Raised** — elevated panels, modals
- **FAB glow** — teal brand tint, only on the floating action button
- **Sheet** — bottom sheets slide up from below; the sheet shadow (`--shadow-sheet`) only on the top edge

### Icons

**Lucide line icons exclusively.** 2px stroke, round caps, 24×24 viewBox — matches the Manrope geometric weight perfectly. Shipped as inline SVG paths via the `Icon` component (no icon font, no sprite). Default size 20px; tab bar 22px; small badges 16px. Never hand-drawn SVG, never emoji as icons.

### Animation & motion

- **Ease-out** (`cubic-bezier(0.2, 0.8, 0.3, 1)`) for everything entering or responding to user input.
- **Ease-in-out** for transitions between states.
- **Fast (120ms)** for color/border hover changes, button press feedback.
- **Base (200ms)** for switches, chips, selection feedback.
- **Slow (320ms)** for timeline fills, status progression.
- **No spring or bounce.** Healthcare = calm and predictable.
- **No decorative looping animations** — no pulsing, no auto-rotating elements.

### Hover & press states

- **Buttons:** background one shade darker on hover; `scale(0.97)` on press.
- **Cards (tappable):** `scale(0.985)` on press, no color/shadow change.
- **List rows:** background shifts to `--surface-sunken` on hover.
- **Chips:** outline becomes teal; fill changes.
- **Tab items:** color shifts to `--teal-600`; stroke weight 2 → 2.4.

### Imagery

No imagery was provided. The design system uses:
- **Avatar initials** with a deterministic teal/brand hue — never placeholder grey squares.
- **Status timeline** as the visual storytelling device for booking progress.
- **Soft teal icon tiles** (38×38, `--radius-md`, `--surface-brand-soft`) to give icons context without imagery.
- When real photography is introduced: cool-toned, clean clinical settings. No stock-photo warmth or over-saturated treatment.

### Backgrounds

- **No full-bleed images** in UI.
- **No patterns or textures.**
- Dark teal card (`--teal-800`) used once per home screen for the "active event" (report ready, booking confirmed) — always contains actionable content, never decoration.

### Transparency & blur

- **Scrim** (`--overlay-scrim`, rgba dark teal 45%) behind bottom sheets and modals.
- **Blur** (`--blur-sheet`, 12px) on the modal scrim when the context behind is a meaningful screen. Used sparingly.
- No frosted glass / glassmorphism on UI elements.

### Layout

- Fixed **56px top bar** on every sub-screen.
- Fixed **bottom tab bar** (~68px including safe area) on all root screens.
- Sticky **payment bar** (tests total + CTA) docked to the bottom on booking screens.
- All scroll is vertical; horizontal only for chip/category rows and date slot pickers (explicitly scoped, never full-screen).

---

## ICONOGRAPHY

**System:** Lucide (ISC license, `lucide.dev`) — line icon set, 2px stroke, round linecap, 24×24 viewBox.

**Labzy icon vocabulary** (bundled in `components/core/Icon.jsx`):

| Name | Use |
|---|---|
| `flask` | Tests / labs; the brand icon for diagnostic science |
| `droplet` | Blood test category; sample collection |
| `shield-check` | NABL/certification verification badge |
| `file-text` | Reports; documents |
| `calendar` | Bookings; slot selection |
| `clock` | TAT / fasting / time info |
| `map-pin` | Location; lab distance |
| `repeat` | Recurring subscriptions |
| `star` | Ratings |
| `download` | Report download |
| `phone` | Masked call |
| `credit-card` | Payments |
| `bell` | Notifications |
| `navigation` | Distance / directions |
| `user` | Patient profile |
| `home` | Home tab |
| `search`, `sliders` | Discovery / filters |
| `check`, `x`, `plus` | Affirmative / dismiss / add actions |

**Rules:**
- No emoji used as icons. Ever.
- No unicode characters as icons.
- No hand-drawn SVG shapes.
- Icon color is always `currentColor` (inherited from container) or a named token. Never an arbitrary hex inside the `Icon` component.
- Size: 16px inside badges/rows · 20px default · 22px in tab bars · 24px in hero/standalone contexts.

---

## INDEX

```
styles.css                         Global CSS entry (imports below)
tokens/
  colors.css                       Brand teal + neutral + semantic + status
  typography.css                   Font families, size, weight, leading tokens
  spacing.css                      4px grid, radii, control sizing
  effects.css                      Shadows, motion, overlay tokens
  fonts.css                        Google Fonts import (Manrope, Montserrat, IBM Plex Mono)
  base.css                         Element resets

assets/brand/
  labzy-logo-original.jpg          Source upload (square on white)
  labzy-wordmark.png               Cropped wordmark on white
  labzy-wordmark-transparent.png   Wordmark, white background removed
  labzy-wordmark-white.png         All-white knockout for dark/teal surfaces

components/core/
  Icon.jsx / .d.ts / .prompt.md    Lucide line icons (24 names)
  Logo.jsx / .d.ts / .prompt.md    CSS wordmark lockup (default + white)
  Button.jsx / .d.ts / .prompt.md  Primary action control (5 variants, 3 sizes)
  IconButton.jsx / .d.ts           Square icon-only button (4 variants)
  Badge.jsx / .d.ts                Status pill (lifecycle tones)
  Card.jsx / .d.ts                 White surface container
  Avatar.jsx / .d.ts               Circular avatar / initials
  Chip.jsx / .d.ts                 Selectable filter chip
  ListRow.jsx / .d.ts              Tappable settings / list row
  core.card.html                   @dsCard: Components group

components/forms/
  Input.jsx / .d.ts                Labeled text input
  SearchBar.jsx / .d.ts            Pill search bar + filter button
  Switch.jsx / .d.ts               Toggle switch
  SegmentedControl.jsx / .d.ts     2–4 option selector
  forms.card.html                  @dsCard: Components group

components/navigation/
  TopBar.jsx / .d.ts               Mobile top app bar
  TabBar.jsx / .d.ts               Bottom tab bar (3–5 items)
  navigation.card.html             @dsCard: Components group

components/domain/
  LabCard.jsx / .d.ts              Lab discovery result card
  TestCard.jsx / .d.ts             Test / package card with add action
  ReportRow.jsx / .d.ts            Report list row with status + download
  StatusTimeline.jsx / .d.ts       Horizontal booking progress timeline
  domain.card.html                 @dsCard: Components group

guidelines/
  brand-logo.html                  Logo lockups on light/brand/dark
  iconography.html                 Icon vocabulary specimen
  colors-brand.html                Teal scale (50–900)
  colors-neutral.html              Neutral scale (0–900)
  colors-semantic.html             Info / warning / success / danger pairs
  colors-status.html               Booking lifecycle status pills
  colors-usage.html                Surface & text semantic aliases in use
  type-display.html                Headings (2xl–md)
  type-body.html                   Body, captions, overlines
  type-mono.html                   IBM Plex Mono in data context
  type-wordmark.html               CSS wordmark face specimen
  spacing-scale.html               4px space scale bars
  radii.html                       Corner radius comparison
  shadows.html                     Elevation levels
  sizing.html                      Control heights

ui_kits/patient_app/
  index.html                       Interactive patient app (4-tab)
  PatientHome.jsx                  Home: search, report banner, labs, tests
  PatientLabDetail.jsx             Lab detail: mode, date/slot, cart, CTA
  PatientBookings.jsx              Active bookings with status timeline
  PatientReports.jsx               Reports list + inline result table
  README.md

ui_kits/partner_app/
  index.html                       Interactive partner app (4-tab)
  PartnerToday.jsx                 Today: stats, incoming requests (accept/decline)
  PartnerOrders.jsx                Orders list, advance booking status
  README.md
```
