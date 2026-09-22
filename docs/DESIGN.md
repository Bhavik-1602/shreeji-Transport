# Design System

The whole interface is English. Field labels are plain words a transport owner already uses: Date, Vehicle No, From, To, Load Ton, Rate/Ton, Total Freight, Driver Advance, Diesel, Toll, Total Expense, Profit.

## Style

Dense, calm, ledger-like. This is a tool someone opens twenty times a day to type numbers, so speed and legibility beat decoration. No gradients, no illustrations, no marketing tone anywhere inside the app.

## Typography

Inter, one family throughout.

| Role | Size | Weight |
|---|---|---|
| Page title | 24px | 600 |
| Section heading | 18px | 600 |
| Body and form input | 15px | 400 |
| Table cell | 14px | 400 |
| Label and helper | 13px | 500 |

All money, weight, kilometre and average values use tabular figures (`font-variant-numeric: tabular-nums`) so columns line up.

## Colors

Base palette:

| Token | Hex | Use |
|---|---|---|
| `primary` | `#0F6B4F` | Buttons, links, active nav |
| `ink` | `#101A1E` | Body text |
| `paper` | `#F1F4F3` | App background |
| `panel` | `#FFFFFF` | Cards, table surface |
| `line` | `#D3DCDA` | Borders, dividers |
| `muted` | `#5C6B70` | Labels, helper text |

Data color code — this is fixed and applies on every screen, table, chart and printout:

| Meaning | Token | Hex |
|---|---|---|
| Profit, payment received, settled | `positive` | `#0F6B4F` |
| Loss, shortage, overdue, delete | `negative` | `#C0362C` |
| Diesel, pending, due soon | `warning` | `#E0932B` |
| Online payment (was UPI) | `online` | `#2563A6` |
| Cash payment | `cash` | `#5C6B70` |

Rules that never change:

- Money coming in is green. Money going out or a loss is red. Waiting on something is amber.
- Color never carries meaning alone. Every colored value also has a word, sign or icon, because red-green colour blindness is common and colour disappears on a printed report.
- No other accent colors are introduced anywhere. If a new state is needed, it is added to this table first.

## Components

**Buttons.** Primary is solid `primary` with white text. Secondary is `panel` with a `line` border. Destructive is solid `negative`, and every destructive action asks for confirmation naming the record.

**Cards and tables.** Border radius 12px, 1px `line` border, no drop shadow. Table rows are 44px tall with a 1px bottom border. Numeric columns are right-aligned, text columns left-aligned.

**Forms.** Labels sit above inputs, never as placeholder text. Computed fields are shown read-only in a tinted row inside the same form, updating live as the user types, so the person sees profit before saving. Validation errors appear under the field in `negative`, stating what to do: "Enter unload tonnage" rather than "Invalid input".

**Status pills.** Small rounded pills using the data colors: Received (green), Pending (amber), Overdue (red).

## UX requirements

- Mobile responsive; the trip entry form is usable on a phone in a truck yard
- Every list has a loading skeleton, an empty state that invites the first action, and an error state that says what failed
- Empty state copy names the action: "No trips yet. Add your first trip."
- Wide tables scroll horizontally inside their own container; the page itself never scrolls sideways
- Visible keyboard focus ring on every interactive element
- Currency always formatted as Indian rupees with Indian digit grouping: ₹27,917.40
- Dates always DD-MM-YYYY, the format on every Indian document
- Reduced motion respected; no animation longer than 200ms
