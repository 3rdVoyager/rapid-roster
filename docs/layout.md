# RapidRoster — Layout

Where each screen lives, what the user sees, and where controls go.

Visual language follows the current site: dark background, blue primary actions, yellow accents on the brand, Material Symbols for icons when helpful. Keep sections calm — one job per panel.

For architecture, see [structure.md](./structure.md).

---

## Pages (URLs)

Each screen is a **folder with its own `index.html`**. Cloudflare Pages serves that as a clean path (no `.html` in the URL).

| URL | File | Who sees it |
| --- | --- | --- |
| `/` | `frontend/index.html` | Marketing / landing — everyone |
| `/sign-in/` | `frontend/sign-in/index.html` | Email sign-in — guests |
| `/app/` | `frontend/app/index.html` | Project workspace — signed-in users |

If someone opens `/app/` while logged out → redirect to `/sign-in/`, then return to `/app/` after login.

Links in the UI should use the folder paths (`/sign-in/`, `/app/`), not filenames.

---

## Shared look

- **Background:** dark (`--bg-color` / elevated panels).
- **Primary button:** solid blue (`--blue`).
- **Danger button:** text or outline red — only for delete.
- **Secondary button:** quiet border / muted fill.
- **Brand:** logo + Rapid**Roster** (yellow on “Roster”), same as landing.
- **Desktop first**, stack cleanly on mobile (header wraps; tabs become a horizontal scroll or select).

Do **not** pack the first screen of the app with stats, tips, and cards. The workspace is a tool, not a dashboard collage.

---

## 1. Landing (`/` → `frontend/index.html`)

Public marketing page. Update copy later so it matches MVP (four rule types including **Balance**, accounts, projects). Structure stays simple.

```
┌──────────────────────────────────────────────────────────────┐
│  [logo] RapidRoster     The problem · Why · Rules   [Sign in]│
│  (nav can grow later: /about/, /docs/, …)                    │
│                                                              │
│  Hero: brand + short pitch + [Get started] / [See problem]   │
│        + large screenshot placeholder                        │
│                                                              │
│  ── The problem (spreadsheet pain) ──                        │
│  ── Why RapidRoster + screenshot slot ──                     │
│  ── Product screenshots (Setup / Generate / Results) ──      │
│  ── Four rules: Cluster / Separate / Limit / Balance ──      │
│  ── How it works (4 steps) ──                                │
│  ── Closing CTA ──                                           │
│                                                              │
│  Footer: MIT / open source                                   │
└──────────────────────────────────────────────────────────────┘
```

**Controls**

| Control | Action |
| --- | --- |
| Get started / Sign in | `/sign-in/` (or `/app/` if session exists) |
| Nav anchors | Scroll to `#problem`, `#why`, `#rules` |
| See the problem | Scroll to `#problem` |

No CSV wizard on the landing page — real work happens in `/app/`. Screenshot frames are placeholders until real images are added.

---

## 2. Sign-in (`/sign-in/` → `frontend/sign-in/index.html`)

One job: get an email magic link.

```
┌──────────────────────────────────────────────────────────────┐
│  [logo] RapidRoster                                          │
│                                                              │
│  Sign in                                                     │
│  We’ll email you a link. No password.                        │
│                                                              │
│  Email  [ _______________________________ ]                  │
│         [ Email me a link ]                                  │
│                                                              │
│  After submit: “Check your email” message                    │
│  Link in email opens verify URL → cookie → /app/             │
└──────────────────────────────────────────────────────────────┘
```

**Controls**

| Control | Action |
| --- | --- |
| Email field | Required |
| Email me a link | `POST /api/auth/request-link` |
| Back to home | Text link to `/` |

---

## 3. App shell (`/app/` → `frontend/app/index.html`)

Always the same chrome. The middle area swaps by **tab**.

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER (sticky)                                              │
│ [logo] RapidRoster   Project ▾ [Name]   [Save]    Account ▾  │
├──────────────────────────────────────────────────────────────┤
│ TABS                                                         │
│  [ Setup ]   [ Rules ]   [ Generate ]   [ Results ]          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    (active tab content)                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Header controls

| Control | Where | Action |
| --- | --- | --- |
| Brand / logo | Left | Go to landing `/` |
| Project menu | Center-left | Dropdown: list projects, **New project**, **Rename**, **Delete** |
| Project name | Next to menu | Shows current name; rename via menu or inline later |
| Save | Right of project | Explicit save to cloud (also autosave later if we want) |
| Account menu | Far right | Email shown; **Sign out** |

Unsaved changes: subtle “Unsaved” text near Save, or dim Save until dirty. Keep it obvious, not clever.

### Tabs

Four equal tabs. Active tab: underlined or stronger text color (yellow or blue — pick one and stick to it).

| Tab | Job |
| --- | --- |
| Setup | People, slots, sizes, slots-per-person, conflict groups |
| Rules | List + add/edit Cluster / Separate / Limit / Balance |
| Generate | Run search, progress, start alternatives |
| Results | View assignments, scores, light tweaks, export |

Switching tabs does **not** discard data; it only changes what is on screen.

---

## 4. Setup tab

Two tables side by side on wide screens; stacked on narrow screens. Global setup sits above or between them.

```
┌──────────────────────────────────────────────────────────────┐
│ Setup                                                        │
│                                                              │
│ Global                                                       │
│   Default slots per person  [ 1 ▼ ]                          │
│   Conflict groups           [ Manage… ]                      │
│   Preset                    [ Apply preset ▼ ]  (optional)   │
│                                                              │
│ ┌─ People ──────────────────┐  ┌─ Slots ───────────────────┐ │
│ │ [ Import CSV ] [ Clear ]  │  │ [ Import CSV ] [ Clear ]  │ │
│ │ Column types: row of ▾    │  │ Column types: row of ▾    │ │
│ │                           │  │                           │ │
│ │ spreadsheet-like table    │  │ spreadsheet-like table    │ │
│ │ (scroll horizontally)     │  │ min/max size columns      │ │
│ │                           │  │                           │ │
│ │ [ + Add row ]             │  │ [ + Add row ]             │ │
│ └───────────────────────────┘  └───────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Setup controls

| Control | Action |
| --- | --- |
| Import CSV (people) | File picker → parse → fill people table; prompt to map column types if needed |
| Import CSV (slots) | Same for slots |
| Clear | Confirm, then empty that table |
| Column type dropdowns | Per column: ID / Number / Time / Text / Ignore (people); ID / MinSize / MaxSize / Text / Ignore (slots) |
| + Add row | Append empty row |
| Default slots per person | Number (often 1) |
| Manage conflict groups | Small modal or inline editor: groups of slot IDs/names that cannot be held together |
| Apply preset | Confirm overwrite warning → load starter people/slots/rules/setup from a pack |

**Column mapping (after import):** if headers are messy, show a short step *above* the table: “Column X → type ▾”, then Continue. Not a separate page.

---

## 5. Rules tab

Left: list of rules. Right: editor for the selected rule (or empty state).

```
┌──────────────────────────────────────────────────────────────┐
│ Rules                                                        │
│                                                              │
│ ┌─ List ─────────────┐  ┌─ Editor ─────────────────────────┐ │
│ │ [ + Add rule ]     │  │ Type     ( ) Cluster  ( ) Sep…   │ │
│ │                    │  │          ( ) Limit    ( ) Balance│ │
│ │ 1. Cluster  P80 ★  │  │                                  │ │
│ │ 2. Limit    P50    │  │ Data     [ choose columns… ]     │ │
│ │ 3. Balance  P40    │  │ Filter   [ optional ]            │ │
│ │                    │  │ Options  exact/partial or min/max│ │
│ │ (click row to edit)│  │ Priority [ 50 ]  Hard [x]        │ │
│ │                    │  │                                  │ │
│ │                    │  │ [ Save rule ]  [ Delete rule ]   │ │
│ └────────────────────┘  └──────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

★ or a “Hard” badge = hard constraint. Soft rules show priority number.

### Rule flow (matches generator.md)

1. Choose **type**
2. Choose **data** (columns / ranges; preview matches when useful)
3. Optional **filter**
4. **Options** (exact vs partial; limit min/max; balance none)
5. **Priority** (1–100) and **hard / soft**

### Rules controls

| Control | Action |
| --- | --- |
| + Add rule | Create blank rule, select it, focus editor |
| Rule row | Select for editing |
| Type radios | Switch type (may reset options that no longer apply) |
| Data picker | Simple: multi-select of column names; advanced cell ranges can wait if needed |
| Filter | Single text value applied to selected data |
| Priority | Number input 1–100 |
| Hard checkbox | Hard = must never break |
| Save rule | Write into project.rules |
| Delete rule | Confirm, remove from list |

Empty state (no rules): short sentence + **+ Add rule**.

---

## 6. Generate tab

Quiet screen: explain what will run, then go.

```
┌──────────────────────────────────────────────────────────────┐
│ Generate                                                     │
│                                                              │
│  Uses current Setup + Rules.                                 │
│  Hard rules must all pass. Soft rules guide the score.       │
│                                                              │
│  [ Generate primary ]     [ Generate alternatives ]          │
│                                                              │
│  Status                                                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Idle / Working… / Done / Failed                        │  │
│  │ Short progress line (e.g. “Improving… pass 12”)        │  │
│  │ Errors listed in plain language if hard rules fail     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  When done: link/button → “View results” (switches tab)      │
└──────────────────────────────────────────────────────────────┘
```

### Generate controls

| Control | Action |
| --- | --- |
| Generate primary | Start Web Worker main run |
| Generate alternatives | Extra runs from different legal starts (enabled after or with primary — either is fine; prefer after primary exists) |
| Cancel (optional) | Stop worker if still running |
| View results | Jump to Results tab |

While working: disable Generate buttons or show spinner on them so double-clicks do not stack jobs.

---

## 7. Results tab

```
┌──────────────────────────────────────────────────────────────┐
│ Results                                                      │
│                                                              │
│  Result set: ( ) Primary  ( ) Alternative 1  ( ) Alt 2 …     │
│  [ Export CSV ]                                              │
│                                                              │
│  View:  [ By slot ]  [ By person ]  [ Satisfaction ]         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Main panel depends on view:                           │  │
│  │                                                        │  │
│  │  By slot — each slot heading + list of people          │  │
│  │  By person — each person + their slot(s)               │  │
│  │  Satisfaction — table: rule name, hard/soft, score     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Light tweaks (MVP-simple):                                  │
│  Select person + target slot → [ Move ] (re-check hard rules)│
└──────────────────────────────────────────────────────────────┘
```

### Results controls

| Control | Action |
| --- | --- |
| Primary / Alternative radios | Switch which assignment set is shown |
| Export CSV | Download current view’s assignments |
| By slot / By person / Satisfaction | Toggle main panel only |
| Move (optional MVP) | Manual reassignment; reject with message if hard rules break |

Empty state (no generation yet): “Run Generate first” + button that switches to Generate tab.

---

## 8. Small overlays (modals)

Use sparingly. Same dark elevated panel, centered, with backdrop.

| Modal | Contents |
| --- | --- |
| New project | Name field + Create / Cancel |
| Rename project | Name field + Save / Cancel |
| Delete project | Warning + Delete / Cancel |
| Conflict groups | List of groups; add/remove slot chips; Done |
| Apply preset | Which preset + “This replaces current setup/rules” + Apply / Cancel |
| Column mapping | After messy CSV import |

Escape or Cancel closes without saving.

---

## Mobile notes

- Header: brand left; project + account menus iconify or stack under brand.
- Tabs: full-width row, scroll sideways if needed.
- Setup: People table full width, then Slots below.
- Rules: List on top, editor below (not side-by-side).
- Keep tap targets large; avoid hover-only actions.

---

## What “done” looks like visually

An organizer can:

1. Land → Sign in → land in app with a project.
2. Setup: import two CSVs, set types and sizes.
3. Rules: add a few rules with priorities and one hard rule.
4. Generate: watch status → open Results.
5. Results: scan by slot, check satisfaction, export CSV.
6. Close the laptop, sign in tomorrow, open the same project.

If a control is not in this doc, it is not MVP UI — add it here before building it.
