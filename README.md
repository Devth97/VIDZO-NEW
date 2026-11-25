# VIDZO

Reference-to-original advertising studio for brands and agencies.

**Status: unfinished application foundation, handed to Claude for continued coding.** GPT will handle visual assets separately. This is not yet a working paid AI video service.

Start with [HANDOFF_TO_CLAUDE.md](HANDOFF_TO_CLAUDE.md). The three original requirements documents and readable extracts are in [handoff/source-documents](handoff/source-documents). The user's warm beige design preference overrides the dark palette in the original design document.

## Run the current screens

Requires Node.js 24 and pnpm 11.25.0.

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:3000/projects**. The root landing page and several navigation destinations are not built yet. Default demo behavior stores drafts in localStorage and uploads in IndexedDB on this device. Demo credits have no cash value. No genuine generated videos are included.

```powershell
pnpm typecheck
pnpm test
pnpm build
```

These three checks pass at handoff. Browser QA and live integration tests are outstanding. Scripts `test:e2e`, `worker:test` and `trigger:dev`/`trigger:deploy` are planned commands with supporting files still missing. Do not enable `VIDZO_MODE=live` yet: API routes and integrations have not been implemented.

Never commit secrets, customer media, dependencies or build output. No deployment ZIP is needed. Target repository: https://github.com/Devth97/VIDZO-NEW.git.
