# RapidRoster

Web app for organizers who place people into **slots** — teams, events, roles, shifts, classrooms, and more — using size limits and a small set of rules.

Create an account, save **projects**, import data, set rules (or start from a preset), generate assignments, review tradeoffs, and export.

## Why it exists

Organizing people is hard: preferences, requests, balance, availability, role caps, and “keep these people apart” fight each other in a spreadsheet. RapidRoster turns those into an explicit rule list and finds placements that respect them.

## How it works

1. **Projects** — Sign in, open the dashboard, create a project, come back later. People, slots, rules, and results are saved.
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

Accounts and saved projects; people into slots; Cluster / Separate / Limit / Balance; generation with a satisfaction report; presets as starter settings; Cloudflare hosting.

## Project layout

```
rapid-roster/
├── docs/           # Specs + example CSVs
├── frontend/       # Pages site: landing, sign-in, /app/, /app/project/
├── functions/      # Pages Functions (/api/auth, /api/projects)
├── migrations/     # D1 schema
├── wrangler.toml   # Pages + D1 binding
└── README.md
```

Live site: [rapidroster.pages.dev](https://rapidroster.pages.dev/).

## Local cloud stack (Pages Functions + D1)

```bash
npm install
npx wrangler d1 create rapid-roster   # copy the new database_id into wrangler.toml
npm run db:migrate:local
npm run sync:functions                # copy functions/ -> frontend/functions/ for Git Pages
npm run dev                           # serves frontend/ + functions/
```

**Note:** The Pages project build root is `frontend/`, so production deploys Functions from `frontend/functions/`. Edit the source of truth in repo-root `functions/`, then run `npm run sync:functions` before pushing.
Sign in with any email. Until email is configured, the magic link is printed in the Wrangler terminal / Pages Function logs. Open that `/api/auth/verify?token=...` URL to set the session cookie.

### Env / secrets

| Name | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | Recommended in production | Reserved for signed session material; set via `wrangler pages secret put SESSION_SECRET` |
| `EMAIL_API_KEY` | Optional | When unset, magic links are logged instead of emailed |
| `APP_ORIGIN` | Optional | Public origin for magic links (defaults to the request origin) |

Bind the D1 database named `DB` on the existing Pages project (dashboard **Settings → Bindings**, or via `wrangler.toml` `database_id`).

Unsigned users keep the previous localStorage-only flow. Signed-in users dual-write: local always, cloud when the project was created/opened from `/api/projects`.

## License

See [LICENSE](./LICENSE).
