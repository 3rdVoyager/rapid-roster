# RapidRoster MVP

## Goal

Build a web app where organizers create **projects**, import people and slots, configure **Cluster / Separate / Limit / Balance** rules, and generate assignments they can review, tweak, and export.

The same engine places people into slots for any use case. **Presets** only load starter CSVs and rules; they do not change how generation works.

Focus for this MVP: **accounts → projects → configure → generate → review → export**.

---

## Product shape

A **project workspace** with a top header (brand, project switcher, account).

```
RapidRoster
  Account
    - Sign up / sign in
    - Own projects (create, rename, open, delete)

  Project workspace
    - People & slots   import/edit tables; column types; sizes; slots-per-person; conflicts
    - Rules            Cluster, Separate, Limit, Balance
    - Generate         main run + alternatives
    - Results          view by slot and by person, satisfaction report, tweaks, export
```

Projects save in the cloud so organizers can leave and come back.

Optional **presets** fill starter settings (e.g. sports, Science Olympiad, volunteers). After that, the project is normal editable data on the same engine.

---

## In scope

### Accounts and projects

- Simple sign-in (e.g. email).
- Create, rename, open, and delete projects.
- Save people, slots, rules, and last results.
- Host on Cloudflare. Generation can run in the browser for typical sizes.

### People and slots (Setup)

- Import people from CSV with typed columns: ID, Number, Time, Text, Ignore.
- Multiple values in a cell with semicolons.
- Slots with ID, MinSize, MaxSize, Text, Ignore; optional conflict groups.
- How many slots each person may hold (project default and/or per person).
- Common shapes such as ranked preference columns (slot names under headers `1`…`n`) — see [examples/](./examples/).
- Re-import and light editing; help mapping messy column names.

### Rules

Shared flow (details in [generator.md](./generator.md)):

1. Choose type — **Cluster**, **Separate**, **Limit**, or **Balance**
2. Choose data (and optional filter)
3. Adjust options (exact/partial, min/max, …)
4. Set priority (1–100) and hard vs soft

| Type | Intent |
| --- | --- |
| **Cluster** | Keep matched people together, or a person in a matching slot (including preference columns ↔ slot names) |
| **Separate** | Keep matched people apart / spread a value |
| **Limit** | Min/max how many of a filtered set appear in each slot |
| **Balance** | Keep a number roughly even across slots |

Conflict groups and slot sizes are Setup, not rule types.

Hard rules must never break. Soft rules guide the score; partial success still counts.

### Generator

- One people-into-slots search for all projects.
- Start legal → improve with small moves → shake up if stuck → offer alternatives from other starts.
- Show how well each soft rule did; clear errors when hard rules cannot be met.

### Results and export

- View by slot and by person.
- Satisfaction summary per rule.
- Light manual moves with hard-rule checks when practical.
- Export CSV.

### Presets

Starter packs that only write settings (CSVs + rules + global defaults). Users can change everything after. Blank projects work with no preset.

---

## Out of scope (later)

- Live multi-user editing
- Team/org accounts and rich sharing
- Mobile apps
- Separate generators per domain
- AI-assisted CSV cleanup
- Heavier solvers unless this one is not enough
- ML assignment
- Billing

---

## Success criteria

Done when an organizer can:

1. Create an account and a saved project.
2. Import people and slots, set sizes / load / conflicts, and add Cluster, Separate, Limit, and Balance rules (including hard rules).
3. Run a Science Olympiad-style preference sheet (rank columns with slot names) via Cluster rules with descending priorities.
4. Generate results, see alternatives, and see how each soft rule scored.
5. Apply a preset, then edit or remove its rules, and still use the **same** generator.
6. Export and reopen later with everything intact.
7. Get clear errors for bad imports and impossible hard rules.

If custom rules work end to end — with presets only as optional starters — the MVP is met.
