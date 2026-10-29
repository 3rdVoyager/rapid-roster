# RapidRoster

Web app for organizers who place people into **slots** — teams, events, roles, shifts, classrooms, and more — using size limits and a small set of rules.

Create a **project** in this browser, import data, set rules (or start from a preset), generate assignments, review tradeoffs, and export.

## Why it exists

Organizing people is hard: preferences, requests, balance, availability, role caps, and “keep these people apart” fight each other in a spreadsheet. RapidRoster turns those into an explicit rule list and finds placements that respect them.

## How it works

1. **Projects** — Open the dashboard, create a project, come back later in the same browser. People, slots, rules, and results are saved locally.
2. **People & slots** — Import CSVs. Set slot min/max size, how many slots each person may hold, and optional conflict groups.
3. **Rules** — Same four types for every project (presets only pre-fill them):
   - **Cluster** — keep matched people together, or put a person in a matching slot (e.g. preference columns filled with slot names)
   - **Separate** — keep matched people apart / spread a value
   - **Limit** — min/max counts per slot for a filtered group (e.g. max 2 keepers)
   - **Balance** — even out a number across slots (e.g. skill)
4. **Prioritize** — Priority 1-10; mark rules **hard** (never break) or soft (best effort, partial credit OK).
5. **Generate** — Same search every time: legal start, improve with small moves, offer alternatives.
6. **Review & export** — See results by slot and by person, check how each rule scored, tweak, download CSV.

Building a rule: pick the type → choose data → optional filter → options → priority and hard/soft.

## Docs

| Doc | What it covers |
| --- | --- |
| [docs/MVP.md](./docs/MVP.md) | Scope and success criteria |
| [docs/generator.md](./docs/generator.md) | Rules, scoring, search behavior |
| [docs/structure.md](./docs/structure.md) | Architecture, folders, build order |
| [docs/layout.md](./docs/layout.md) | Screens and controls |
| [docs/examples/](./docs/examples/) | Sample CSVs / presets data |

## MVP scope

Local saved projects; people into slots; Cluster / Separate / Limit / Balance; generation with a satisfaction report; presets as starter settings; Cloudflare Pages hosting (static).

## Project layout

```
rapid-roster/
├── docs/           # Specs + example CSVs
├── frontend/       # Pages site: landing, /app/, /app/project/
├── future/         # Archived accounts / D1 / Functions (not live)
├── wrangler.toml   # Pages static deploy
└── README.md
```

Live site: [rapidroster.pages.dev](https://rapidroster.pages.dev/).

## Local development

```bash
npm install
npm run dev           # serves frontend/ on Cloudflare Pages local
```

Projects save in the browser (localStorage). Cloud accounts, D1, and Pages Functions are parked under [`future/`](./future/) until you are ready to bring them back.

## License

See [LICENSE](./LICENSE).
