# Future: accounts, D1, and Pages Functions

Archived when RapidRoster went local-first. Recreate Cloudflare pieces when you are ready for email magic links and cloud sync.

## What’s here

| Path | Role |
| --- | --- |
| `functions/` | Pages Functions source (`/api/auth/*`, `/api/projects/*`) |
| `migrations/` | D1 schema (`users`, `auth_tokens`, `sessions`, `projects`) |
| `frontend-js/` | Browser clients: `api.js`, `account.js`, `sign-in.js` |
| `_routes.json` | Was at `frontend/_routes.json` — routes `/api/*` to Functions |

## Restore sketch

1. Move `functions/` and `migrations/` back to the repo root.
2. Copy `frontend-js/*` into `frontend/js/`.
3. Put `_routes.json` back under `frontend/`.
4. Re-add D1 + (optional) `send_email` to `wrangler.toml`, create a new D1 database, apply migrations.
5. Run `npm run sync:functions` (re-add that script) so Git Pages deploys `frontend/functions/`.
6. Re-wire dual-write in `state.js` / account UI (see git history if needed).

Do not commit secrets. Use `wrangler pages secret put` for API tokens.

## Delete leftover remote D1 (optional)

If the old `rapid-roster` D1 database still exists in your Cloudflare account:

```bash
npx wrangler login
npx wrangler d1 delete rapid-roster
```

Or delete it in the dashboard under **Workers & Pages → D1**. Also remove any D1 / Functions bindings on the Pages project settings.
