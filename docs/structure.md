# RapidRoster — Structure

How the app is built and where each piece lives.

This doc is the grounding for implementation. Product rules live in [generator.md](./generator.md) and [MVP.md](./MVP.md). Screen layout lives in [layout.md](./layout.md).

---

## Goals for the build

- Stay on **Cloudflare** (Pages, Functions, D1).
- Stay **simple**: HTML, CSS, and **vanilla JavaScript** — no React, Vue, Svelte, or other UI frameworks.
- Prefer **longer, clearer code** over short clever code.
- Generation runs in the **browser** (typical roster sizes). The server stores accounts and projects.
- Look and feel **professional**, not flashy.

---

## Big picture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Cloudflare Pages — static HTML/CSS/JS)        │
│                                                         │
│  Landing → Sign in → Dashboard (/app/)                  │
│                         ↓                               │
│              Project workspace (/app/project/)          │
│                                                         │
│  Workspace talks to:                                    │
│    • /api/...          save/load projects, auth         │
│    • generator worker  run the search off the main UI   │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────┐
│  Cloudflare Pages Functions (small server scripts)      │
│    /api/auth/...     email sign-in                      │
│    /api/projects/... create / read / update / delete    │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Cloudflare D1 (SQLite database)                        │
│    users, sessions, projects                            │
└─────────────────────────────────────────────────────────┘
```

**What runs where**

| Work | Where | Why |
| --- | --- | --- |
| Import CSV, edit tables, build rules, show results | Browser | Instant UI; no server round-trip |
| Search / improve assignments | Browser **Web Worker** | Heavy looping; keeps the page from freezing |
| Sign in, save projects | Pages Functions + D1 | Cloud save so you can leave and come back |
| Email magic link | Pages Function + Cloudflare Email / Mailchannels | Stay on Cloudflare; no third-party auth product |

We are **not** using Cloudflare Access (Zero Trust) as the product login. Access is for locking internal sites. RapidRoster needs normal “sign up / sign in / my projects” accounts.

---

## Repo layout (target)

Folders and files we aim for. Not everything exists yet; this is the map.

```
rapid-roster/
├── docs/
│   ├── MVP.md
│   ├── generator.md
│   ├── structure.md          ← this file
│   ├── layout.md             ← screens and controls
│   └── examples/             ← sample CSVs / presets data
│
├── frontend/                 ← what Pages serves as the website
│   ├── index.html            ← `/` marketing / landing
│   ├── sign-in/
│   │   └── index.html        ← `/sign-in/` email sign-in
│   ├── app/
│   │   ├── index.html        ← `/app/` project dashboard
│   │   └── project/
│   │       └── index.html    ← `/app/project/` workspace
│   ├── assets/               ← logo, favicons
│   ├── css/
│   │   ├── variables.css     ← shared tokens
│   │   ├── global.css        ← shared base styles
│   │   ├── buttons.css       ← shared buttons
│   │   ├── site/             ← public pages
│   │   │   ├── header.css
│   │   │   ├── footer.css
│   │   │   ├── home.css
│   │   │   └── sign-in.css
│   │   └── app/              ← signed-in product
│   │       ├── app.css       ← shared app chrome
│   │       ├── dashboard.css
│   │       └── project.css
│   └── js/                   ← shared scripts (link as /js/...)
│       ├── api.js            ← talk to /api (fetch wrappers, clear names)
│       ├── dashboard.js      ← project list / create / open
│       ├── project.js        ← wire workspace panels ↔ state
│       ├── state.js          ← current project in memory (plain object)
│       ├── csv.js            ← parse / export CSV (simple string splitting + helpers)
│       ├── tables.js         ← render editable people/slots tables
│       ├── rules-ui.js       ← rule list + add/edit form
│       ├── results-ui.js     ← results views + satisfaction report
│       └── generator/
│           ├── score.js      ← score a placement against soft rules
│           ├── legal.js      ← hard rules + size / conflict checks
│           ├── search.js     ← start legal → improve → shake → alternatives
│           └── worker.js     ← Web Worker entry (runs search off the main thread)
│
├── functions/                ← Cloudflare Pages Functions (server)
│   └── api/
│       ├── auth/
│       │   ├── request-link.js   ← POST email → send magic link
│       │   └── verify.js         ← GET/POST token → create session
│       ├── projects.js           ← list / create
│       └── projects/
│           └── [id].js           ← get / update / delete one project
│
├── migrations/               ← D1 SQL schema versions
│   └── 0001_init.sql
│
├── wrangler.toml             ← Pages + D1 binding config
├── README.md
└── LICENSE
```

**Naming habit:** one job per file. If a file grows past ~300–400 lines and mixes jobs, split it. Prefer `doThing()` functions with obvious names over nested one-liners.

---

## What a “project” is

A project is one saved workspace: people, slots, setup knobs, rules, and (optional) last generation results.

Stored in D1 mostly as **JSON text** inside a row. That keeps the database schema small and the browser code simple (load JSON → work on a normal object → save JSON).

### In-memory shape (browser)

```text
project = {
  id: "...",
  name: "Spring SciOly",
  updatedAt: "...",

  people: {
    columns: [ { key, label, type } ],   // type: id | number | time | text | ignore
    rows: [ { id, cells: { ... } } ]
  },

  slots: {
    columns: [ { key, label, type } ],   // type: id | minSize | maxSize | text | ignore
    rows: [ { id, cells: { ... } } ]
  },

  setup: {
    defaultSlotsPerPerson: 1,
    // optional per-person overrides later
    conflictGroups: [ ["Event A", "Event B"], ... ]
  },

  rules: [
    {
      id, type,           // cluster | separate | limit | balance
      data, filter,       // which columns / cells
      options,            // exact/partial, min/max, ...
      priority,           // 1–10
      hard: true/false
    }
  ],

  results: null | {
    primary: { assignments, scoresByRule, totalScore },
    alternatives: [ ... ]
  }
}
```

Exact field names can tighten during implementation; the idea stays: **one object = one project**.

### Database tables (D1)

Keep three tables for MVP:

| Table | Purpose |
| --- | --- |
| `users` | `id`, `email`, `created_at` |
| `sessions` | `id`, `user_id`, `token_hash`, `expires_at` |
| `projects` | `id`, `user_id`, `name`, `data_json`, `updated_at` |

`data_json` holds people, slots, setup, rules, results. List screens only need `id`, `name`, `updated_at`.

---

## Auth (Cloudflare-only, simple)

**Magic link (email):**

1. User types email on sign-in page → `POST /api/auth/request-link`.
2. Function stores a short-lived token and emails a link.
3. User clicks link → `GET /api/auth/verify?...` sets an **httpOnly cookie** session.
4. Later API calls check that cookie and only return **that user’s** projects.

No passwords for MVP. No Google/GitHub unless we add them later.

**Session rule:** every project API requires a valid session; always filter by `user_id`.

---

## Generator (browser)

Follow [generator.md](./generator.md). One engine for every project.

```
project.js  →  asks worker to run
              │
              ▼
         worker.js
              │
              ├── legal.js   (hard constraints)
              ├── score.js   (soft score)
              └── search.js  (moves: add / remove / move / swap)
```

**Web Worker (plain explanation):** normal JS shares one “main thread” with the page. A long loop freezes clicks and scrolling. A **worker** is a separate JS file that runs in the background and sends messages (`postMessage`) when done. We put the search there so the Generate screen can show “Working…” without locking up.

**Presets** are not a second engine. They only fill people/slots/rules/setup from files under `docs/examples/`.

---

## Frontend coding style

- **Vanilla JS only** — `document.querySelector`, `addEventListener`, `fetch`, plain objects/arrays.
- **No build step required for MVP** if we can avoid it (plain `.js` modules via `<script type="module">`). If we later need a bundler for the worker, keep it minimal.
- **Explain-friendly code:** early returns, named steps, comments for *why*, not for *what*.
- **DOM habit:** prefer updating clear regions (`#people-table`, `#rule-list`) over rewriting the whole page.
- **State habit:** one `state` object in `state.js`; UI reads from it and writes through small functions like `setProjectName(name)`.

---

## Cloudflare wiring

| Piece | Role |
| --- | --- |
| **Pages** | Hosts `frontend/` (HTML/CSS/JS/assets). Folder `index.html` files give clean URLs: `/`, `/sign-in/`, `/app/`, `/app/project/`. |
| **Pages Functions** | `functions/api/...` — auth + project CRUD |
| **D1** | Users, sessions, projects |
| **Wrangler** | Local dev + deploy + migrations |
| **Email sending** | Magic links from a Function (Cloudflare Email Routing / Email Workers or Mailchannels — pick one during auth build) |

Deploy target stays the same site family as today: [rapidroster.pages.dev](https://rapidroster.pages.dev/).

---

## Build order

**Done (HTML/CSS shells):** landing, sign-in, `/app/` dashboard, `/app/project/` workspace with sidebar panels.

**Next:**

1. **Generator core** (`legal` → `score` → `search`) + tests against `docs/examples/`.
2. **Wire project workspace** with `localStorage` save — dogfood without auth.
3. **CSV import/export** and typed columns.
4. **Rules UI** (add / edit / priority / hard).
5. **Wire generator worker** + results + satisfaction report.
6. **Dashboard logic** — real project list, create / rename / delete (still local or then cloud).
7. **D1 + auth + project API** — replace `localStorage` with cloud save.
8. **Presets** (load example packs into a new/blank project).
9. **Polish** — error messages from generator.md; any remaining landing copy.

Do not start with auth. The engine and workspace are the product; login is the locker.

---

## Out of scope (for this structure)

- UI frameworks
- Live multi-user editing
- Org / team accounts
- Running the generator on Workers for MVP
- Separate engines per sport / SciOly / volunteers
- Billing
