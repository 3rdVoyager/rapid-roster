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
| `/app/` | `frontend/app/index.html` | Project dashboard — signed-in users |
| `/app/project/` | `frontend/app/project/index.html` | One project workspace — signed-in users |

If someone opens `/app/` while logged out → redirect to `/sign-in/`, then return to `/app/` after login.

Links in the UI should use the folder paths (`/sign-in/`, `/app/`, `/app/project/`), not filenames.

---

## Shared look

- **Background:** dark (`--bg-color` / `--header-bg-color` / `--card-bg-color`).
- **Primary button:** `--primary-button-color` (maps to `--color-blue`).
- **Secondary button:** bordered / yellow accent (`--secondary-button-color`).
- **Tertiary button:** quiet fill (`--tertiary-button-color`) — nav and chrome.
- **Danger button:** text or outline red — only for delete (add when needed).
- **Brand:** logo + Rapid**Roster** (yellow on “Roster” via `--color-yellow`).
- **Desktop first**, stack cleanly on mobile (header wraps; app sidebar becomes a horizontal row).
- **CSS layout:** shared tokens in `css/variables.css`, `global.css`, `buttons.css`; site pages use `css/site/`; app pages use `css/app/`.

Do **not** pack the project workspace with stats, tips, and cards. The workspace is a tool, not a dashboard collage. The `/app/` dashboard is only a project list — keep it simple too.

---

## 1. Landing (`/` → `frontend/index.html`)

Public marketing page. Copy covers the problem, why RapidRoster, four rules (including **Balance**), and how it works.

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
│  Footer: logo + blurb · Product / Resources / Project links · MIT │
└──────────────────────────────────────────────────────────────┘
```

**Controls**

| Control | Action |
| --- | --- |
| Get started / Sign in | `/sign-in/` (or `/app/` if session exists) |
| Nav anchors | Scroll to `#problem`, `#why`, `#rules` |
| See the problem | Scroll to `#problem` |

No CSV wizard on the landing page — real work happens in `/app/` (dashboard) and `/app/project/` (workspace). Screenshot frames are placeholders until real images are added.

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

## 3. App dashboard (`/app/` → `frontend/app/index.html`)

Signed-in home. No sidebar — pick or create a project.

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER                                                       │
│ [logo] RapidRoster                              Account ▾    │
├──────────────────────────────────────────────────────────────┤
│ Projects                                    [ New project ]  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Spring SciOly                         updated ·  ›    │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ Volunteer weekend                     updated ·  ›    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Dashboard controls

| Control | Action |
| --- | --- |
| New project | Create project → open `/app/project/` |
| Project row | Open that project workspace |
| Account | Email + Sign out (later) |

Later: rename / delete from the row menu or after open. Placeholder rows are for layout only.

---

## 4. Project workspace (`/app/project/` → `frontend/app/project/index.html`)

One open project. Sidebar switches panels (Setup / Rules / Generate / Results).

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER                                                       │
│ [logo] → /app/   [All projects]  Name  Unsaved  [Save]  Acc  │
├────────────┬─────────────────────────────────────────────────┤
│ SIDEBAR    │                                                 │
│  Setup     │              (active panel content)             │
│  Rules     │                                                 │
│  Generate  │                                                 │
│  Results   │                                                 │
└────────────┴─────────────────────────────────────────────────┘
```

### Header controls

| Control | Where | Action |
| --- | --- | --- |
| Brand / logo | Left | Back to dashboard `/app/` |
| All projects | Near brand | Back to dashboard |
| Project name | Center | Current project title |
| Save | Right of name | Save to cloud (later) |
| Account | Far right | Email + Sign out (later) |

Unsaved changes: subtle “Unsaved” text near Save.

### Sidebar

Four panels in workflow order. Active item: left accent bar + stronger text (blue).

| Panel | Job |
| --- | --- |
| Setup | Entries, slots, sizes, slots-per-entry, conflict groups |
| Rules | List + add/edit Cluster / Separate / Limit / Balance |
| Generate | Run search, progress, start alternatives |
| Results | View assignments, scores, light tweaks, export |

Switching panels does **not** discard data; it only changes what is on screen.

**Mobile:** collapse sidebar to a horizontal row so tables keep width.

---

## 5. Setup panel

Two tables side by side on wide screens; stacked on narrow screens. Global setup sits above or between them.

```
┌──────────────────────────────────────────────────────────────┐
│ Setup                                                        │
│                                                              │
│ Global                                                       │
│   Default slots per entry   [ 1 ▼ ]                          │
│   Conflict groups           [ Manage… ]                      │
│   Preset                    [ Apply preset ▼ ]  (optional)   │
│                                                              │
│ ┌─ Entries ─────────────────┐  ┌─ Slots ───────────────────┐ │
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
| Import CSV (entries) | File picker → parse → fill entries table; prompt to map column types if needed |
| Import CSV (slots) | Same for slots |
| Clear | Confirm, then empty that table |
| Column type dropdowns | Per column: ID / Number / Time / Text / Ignore (entries); ID / MinSize / MaxSize / Text / Ignore (slots) |
| + Add row | Append empty row |
| Default slots per entry | Number (often 1) |
| Manage conflict groups | Small modal or inline editor: groups of slot IDs/names that cannot be held together |
| Apply preset | Confirm overwrite warning → load starter entries/slots/rules/setup from a pack |

**Column mapping (after import):** if headers are messy, show a short step *above* the table: “Column X → type ▾”, then Continue. Not a separate page.

---

## 6. Rules panel

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

1. Set a short **name** (shown in the rule list and Review)
2. Choose **type**
3. Choose **data** (columns / ranges; preview matches when useful)
4. Optional **filter**
5. **Options** (exact vs partial; limit min/max; balance none)
6. **Priority** (1–10) and **hard / soft**

### Rules controls

| Control | Action |
| --- | --- |
| + Add rule | Create blank rule, select it, focus editor |
| Rule row | Select for editing (shows the rule name) |
| Name | Short label, e.g. “Balance skill” |
| Type radios | Switch type (may reset options that no longer apply) |
| Data picker | Simple: multi-select of column names; advanced cell ranges can wait if needed |
| Filter | Single text value applied to selected data |
| Priority | Number input 1–10 |
| Hard checkbox | Hard = must never break |
| Save rule | Write into project.rules |
| Delete rule | Confirm, remove from list |

Empty state (no rules): short sentence + **+ Add rule**.

---

## 7. Generate panel

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
│  When done: link/button → “View results” (switches panel)    │
└──────────────────────────────────────────────────────────────┘
```

### Generate controls

| Control | Action |
| --- | --- |
| Generate primary | Start Web Worker main run |
| Generate alternatives | Extra runs from different legal starts (enabled after or with primary — either is fine; prefer after primary exists) |
| Cancel (optional) | Stop worker if still running |
| View results | Jump to Results panel |

While working: disable Generate buttons or show spinner on them so double-clicks do not stack jobs.

---

## 8. Results panel

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

Empty state (no generation yet): “Run Generate first” + button that switches to Generate panel.

---

## 9. Small overlays (modals)

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
- App sidebar: horizontal row under the header on small screens.
- Setup: People table full width, then Slots below.
- Rules: List on top, editor below (not side-by-side).
- Keep tap targets large; avoid hover-only actions.

---

## What “done” looks like visually

An organizer can:

1. Land → Sign in → land on the **project dashboard**.
2. Create or open a project → **workspace** with sidebar.
3. Setup: import two CSVs, set types and sizes.
4. Rules: add a few rules with priorities and one hard rule.
5. Generate: watch status → open Results.
6. Results: scan by slot, check satisfaction, export CSV.
7. Close the laptop, sign in tomorrow, open the same project from the dashboard.

If a control is not in this doc, it is not MVP UI — add it here before building it.
