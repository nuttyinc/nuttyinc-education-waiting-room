# NuttyInc Education

A calm classroom waiting room with teacher controls, account signup through ChatGPT, a beta notice, and encrypted display names.

- [Open the hosted app](https://nuttyinc-education-room.slaney-scott.chatgpt.site)
- [Source repository](https://github.com/nuttyinc/nuttyinc-education-waiting-room)
- GitHub Pages entry page: `docs/index.html`

The hosted app currently has owner-only access. Repository access and GitHub Pages access do not grant access to the hosted app.

## Features

- Create an account profile after ChatGPT sign-in.
- Teachers create rooms and share unique classroom codes.
- Students join a waiting room and see their own admission status.
- Teachers admit individual learners or everyone waiting, remove entries, and close or reopen a room.
- Display names are encrypted in Cloudflare D1 using AES-256-GCM and a server-only key. Teachers can reveal names only in rooms they own. Students see only their own entries.
- Persistent beta warning and responsive student and teacher layouts.

## Source layout

- `app/room.tsx` — student and teacher interface
- `app/globals.css` — responsive styles and plant illustration
- `app/api/room/route.ts` — authenticated account, room, queue, and encryption operations
- `app/chatgpt-auth.ts` — Sites authentication helpers
- `db/schema.ts` and `drizzle/` — database schema and migration
- `worker/index.ts` — server entrypoint
- `docs/` — static GitHub Pages entry page
- `scripts/` — build and preview tooling
- `DEVELOPMENT.md` — runtime and starter tooling reference

## Run locally

Requires Node.js 22.13 or newer.

1. Run `npm run install:ci`.
2. Create an untracked `.dev.vars` with `NAME_ENCRYPTION_KEY=<base64-encoded 32-byte key>`. Generate your own development key with:
   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```
3. Run `npm run build`.
4. Apply the initial migration to the local preview database:
   ```sh
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_supreme_leper_queen.sql
   ```
5. Run `npm run dev` and open the printed localhost URL.

Local loopback development provides a simulated sign-in identity. Hosted sign-in is supplied by Sites. The production database and encryption key are not included in this repository.

## Checks

```sh
npx tsc --noEmit
npm run build
```

The original application passed TypeScript and production build checks. Its local page returned HTTP 200. Automated visual browser verification was unavailable.

## Hosting and GitHub Pages

GitHub Pages hosts static HTML, CSS, and JavaScript; it cannot run this app's server routes, ChatGPT sign-in dispatch, or D1 database. The `docs/` page links to the full hosted app and explains access.

To publish the entry page, open repository **Settings → Pages**, choose **Deploy from a branch**, then select the default branch and **/docs**. Preserve any existing Pages configuration if the repository already hosts a different site.

The full app uses Sites hosting, with the `DB` D1 binding and the server secret `NAME_ENCRYPTION_KEY`. The existing Site identity is retained in `.openai/hosting.json`. Do not replace the encryption key for an existing database without a data migration: existing encrypted names depend on it.

The current server trusts identity headers supplied by Sites. Do not deploy it behind a generic server that accepts those headers directly from visitors.

## Beta status

This is an early beta. Use nicknames for testing. Production secrets, private records, installed dependencies, and generated runtime files are excluded from the source.
