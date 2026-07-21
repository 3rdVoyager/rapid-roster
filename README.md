# RapidRoster

Web app for organizers who need to turn a participant list into fair, rule-aware groups — teams, cohorts, shifts, classrooms, and similar.

Import a CSV, describe what “good” looks like with a few goals, and generate groupings you can review and export.

## How it works

1. **Import data** — Upload participants. Columns can be typed (text, numeric, dates/times, ranges, IDs). Cells may hold multiple values separated by `;`.
2. **Configure goals** — Instead of dozens of one-off rules, pick from three fundamentals:
   - **Cluster** — keep similar people together (siblings, departments, overlapping availability)
   - **Separate** — spread similar people apart (schools, experienced players)
   - **Limit** — cap or require counts per group (max 2 goalkeepers, min 1 coach)
3. **Prioritize** — Each goal has a priority (1–100). Mark critical ones as **hard constraints**; those placements are never broken. Soft goals guide the search via score.
4. **Generate** — A primary run seeds groups, then improves them with the best relocate or swap each step. Secondary runs start from random layouts to offer alternatives.
5. **Review & export** — Inspect the result and download groupings as CSV.

Full generator design: [docs/generator.md](./docs/generator.md).

## MVP scope

The first version is a wizard-style flow focused only on high-quality grouping:

Configure data → Configure goals → Generate → Review & export

See [docs/MVP.md](./docs/MVP.md) for in-scope features, out-of-scope items, and success criteria.

## Project layout

```
rapid-roster/
├── docs/           # Product and generator specs
├── frontend/       # Wizard UI
└── README.md
```

## License

See [LICENSE](./LICENSE).
