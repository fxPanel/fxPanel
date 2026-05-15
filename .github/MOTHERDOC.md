# fxPanel — AI orientation (Motherdoc)

This file is the **canonical in-repo briefing** for automated assistants. Every claim below is tied to something in this repository unless explicitly marked **unverified** or **ask the maintainers**.

If something here conflicts with chatty summaries or third-party posts, **trust the code and this file**, then re-read the cited paths.

---

## Product and developer documentation (outside this repo)

Long-form guides (development, addons, configuration, etc.) are maintained in **[SomeAussieGaymer/fxPanel-Docs](https://github.com/SomeAussieGaymer/fxPanel-Docs/tree/main)** — Markdown sources **pulled by [fxpanel.org](https://fxpanel.org/docs)** for the public site.

**For AIs and tooling**: prefer that **GitHub tree** over scraping the website when you need to quote steps, headings, or version-specific pages. Browse by version folder (e.g. `v0.3.0-Beta/`) so answers match the release you are working on. The in-repo `docs/` folder is **not** a full copy of that corpus.

---

## What to do and what not to do (especially for AIs)

### Do

- **Verify in this repo first**: read the files you change, nearby callers, tests, and configs before asserting behavior.
- **Follow `docs/CONTRIBUTING.md` and `.github/copilot-instructions.md`** for style, Vitest shape (`suite` / `it` / `expect`), and hooks.
- **Keep edits scoped** to the task; avoid unrelated refactors, churn in generated output, or extra docs files unless asked.
- **Match the stack of the package** you touch (`core` Koa/Node vs `panel` Radix/Tailwind vs `nui` MUI/CEF) — do not copy patterns blindly across packages.
- **Run or propose checks** from `CONTRIBUTING.md` (`test`, `typecheck`, `lint`, `format:check`) when claiming a change is complete.
- **Use official docs for product truth**: behavior, recipes, addon APIs → **[fxPanel-Docs](https://github.com/SomeAussieGaymer/fxPanel-Docs/tree/main)** plus code; do not invent endpoints, env vars, or migration steps.
- **Update this Motherdoc and `CONTRIBUTING.md`** when you change documented behavior (env vars, OS support, build outputs, hooks).

### Do not

- **Commit `!` + `NC` markers** (the contiguous no-commit tag) in staged additions — `.husky/pre-commit` will fail the commit (`docs/CONTRIBUTING.md`).
- **Raise the NUI build target** above **`chrome103`** without an explicit compatibility decision — FiveM CEF is pinned in `nui/vite.config.ts` for a reason.
- **Assume branch defaults** (`dev` vs `master`) or release policy without checking the remote / maintainer guidance.
- **Treat `scripts/package.json` as canonical** for workspaces or Husky — the **repository root** `package.json` is.
- **Present guesses as facts** for anything legal, security-critical, or fxPanel compatibility depth — say you are unsure and point to code or docs, or ask a human.
- **Rely on `docs/development.md`** in this tree — it is often **missing** here; use **fxPanel-Docs** or `scripts/build/dev.ts` + `shared/txDevEnv.ts` instead.

---

## What this project is

- **Name / npm package**: root `package.json` declares `"name": "fxpanel"` at version **0.2.2** (your checkout folder name may differ, e.g. a release tag).
- **Stated goal**: `package.json` `description` — *“fxPanel - A Replacement for txAdmin built on its source code.”*
- **Public positioning** (marketing + compatibility claims): `docs/README.md` describes a full overhaul built on fxPanel, drop-in replacement for the `monitor` folder, compatibility with existing txAdmin `txData`, etc. Treat operational guarantees as **product documentation**, not automatically verified by this doc.

---

## Repository layout (high level)

| Path | Role (from `package.json` / `docs/CONTRIBUTING.md` / package manifests) |
|------|---------------------------------------------------------------------------|
| `core/` | Node backend: FXServer integration, HTTP (Koa), Socket.IO, modules, routes (`fxpanel-core`). |
| `panel/` | Web panel: React + Vite (`panel/package.json` lists Radix, Tailwind 4, Jotai, wouter, etc.). |
| `nui/` | In-game NUI: React + MUI + Emotion, built to `monitor/nui` (`fxpanel-nui`). |
| `shared/` | Shared TypeScript (e.g. Zod, `txDevEnv`); **no tests** in root test script (workspace echoes skip). |
| `resource/` | FXServer Lua/JS resource scripts shipped with the monitor bundle. |
| `scripts/` | Build, dev orchestration, locale utilities, OpenAPI generation, etc. |
| `monitor/` | **Build output** for production-style artifacts (wiped/rebuilt by `npm run build` per root `package.json`). Not a source-of-truth package. |
| `locale/` | Translation JSON (35 `*.json` files under `locale/` as of this doc). |
| `docs/` | In-repo docs (`README.md`, `CONTRIBUTING.md`, `theme.md`, `openapi.json`). |
| `addon-sdk/` | `@fxpanel/addon-sdk` — separate `package.json`, **not** listed in root npm `workspaces`. |
| `bot/` | `fxpanel-discord-bot`, private, CommonJS — **not** in root `workspaces`. |

---

## npm workspaces

Root `package.json` `workspaces` are exactly: **`core`**, **`nui`**, **`panel`**, **`shared`**.

Commands such as `npm run test --workspaces` and `npm run typecheck --workspaces` apply to those four only.

---

## Build and runtime targets (verified)

- **Panel build**: Vite → `monitor/panel` with hashed filenames (`panel/vite.config.ts`).
- **NUI build**: Vite `build.target` is **`chrome103`** (`nui/vite.config.ts`) — aligns with FiveM CEF constraints; do not raise the target without checking game client compatibility.
- **Published core bundle**: `scripts/build/publish.ts` runs `esbuild` with `platform: 'node'`, **`target: 'node16'`**, **`format: 'cjs'`**, output `./monitor/core/index.js`. Production artifact is **CommonJS on Node 16+**, not the same as day-to-day TypeScript `"module": "ES2020"` in `core/tsconfig.json`.
- **TypeScript / Node for authoring**: `core/tsconfig.json` extends `@tsconfig/node22`.

---

## Local development environment

### `TXDEV_*` variables

Authoritative parser and field list: `shared/txDevEnv.ts`.

Notable behaviors verified in code:

- **`TXDEV_FXSERVER_PATH`**: required for NUI dev mode and core dev builder path resolution (see `nui/vite.config.ts`, `scripts/build/dev.ts`).
- **`TXDEV_VITE_URL`**: defaults to `http://localhost:40122` if unset (`shared/txDevEnv.ts`). `scripts/build/dev.ts` still expects a usable panel URL together with `TXDEV_FXSERVER_PATH` — see that file’s startup check.
- **`TXDEV_NO_SPAWN`**: if set truthy, dev builder **does not spawn FXServer** (watch/rebuild/copy only). On **macOS**, `scripts/build/dev.ts` **always** enables this path (`process.platform === 'darwin'`), because **full dev mode (spawning FXServer) is only supported on Windows and Linux** (see OS subsection below).

### Ports (from package scripts / defaults)

- Panel dev server: **`40122`** (`panel/package.json` `dev` script; matches default `TXDEV_VITE_URL`).
- NUI browser dev: **`40121`** (`nui/package.json` `browser` script).

### OS: development, `npm run build`, vs full dev mode (FXServer spawn)

- **Develop and build on any OS**: you can work on **Windows, macOS, or Linux** and run **`npm run build`** locally; CI also runs that build on **Ubuntu, Windows, and macOS** (`.github/workflows/run-tests.yml`).
- **Full dev mode (FXServer spawned by the core dev builder)** — i.e. `cd core && npm run dev` with **`TxAdminRunner`** killing/spawning FXServer around rebuilds — is **only supported on Windows and Linux**. It does **not** run that way on macOS.
- **macOS and optional `TXDEV_NO_SPAWN` (Windows/Linux)**: same `core` `npm run dev` entrypoint runs in **watch / sync / rebuild-only** mode (no local FXServer child). Use that on macOS, or on any OS when FXServer runs elsewhere (remote, Docker, etc.).
- **`docs/CONTRIBUTING.md`** is kept aligned with **`scripts/build/dev.ts`** for OS and dev-mode behavior; change both together if the builder logic changes.

### Node.js version

- `docs/CONTRIBUTING.md`: Node **v22.9+**.
- CI: **Node 22** (`.github/workflows/run-tests.yml`).
- Align local and CI with **Node 22**.

---

## Code style and review expectations

### Human / Copilot summary

`.github/copilot-instructions.md` duplicates several rules; keep it in sync when you change conventions.

### Prettier (root of repo)

`prettier.config.js`: **single quotes**, **tab width 4**, **print width 120**, **`trailingComma: 'all'`**, `prettier-plugin-tailwindcss`, `endOfLine: 'auto'`.

### ESLint

- **`core/eslint.config.js`**: flat config, `@typescript-eslint/recommended`, Prettier conflict rules off via `eslint-config-prettier`, FiveM-like globals for Lua-adjacent TS in resource tooling — read the file before assuming browser globals everywhere.
- **`panel/eslint.config.js`**: React Hooks + React Refresh plugins on top of TypeScript recommended.

### Lua

- `.stylua.toml` present at repo root; `docs/CONTRIBUTING.md` says **StyLua**, 4-space indent for `resource/`.

### Vitest structure

`docs/CONTRIBUTING.md` and `.github/copilot-instructions.md` agree:

- Import **`suite`, `it`, `expect`** from `vitest`.
- One top-level **`suite()`** per file with tests as **`it()`** cases.

### TypeScript habits (from Copilot + CONTRIBUTING)

- Prefer **implicit** return types (exceptions exist; follow surrounding code).
- Prefer **arrow functions** except **React components** (naming / `function` components where already used).
- Prefer **`for...of`** over `.forEach()`.
- **ESM** — root and packages use `"type": "module"` where declared.

---

## No-commit tags and git hooks

- **Meaning**: lines that must not ship; used for temporary debug or pre-merge TODOs (`docs/CONTRIBUTING.md`).
- **Enforcement**: `.husky/pre-commit` greps **staged additions** (`git diff --cached`) for the contiguous `!` + `NC` marker in added lines and **aborts the commit** if found.
- **Important detail**: the hook keys off **lines starting with `+` in the patch** that contain that marker. Behavior for edge cases is defined by that shell pipeline — read `.husky/pre-commit` before relying on subtleties.

**Commit messages**: `.husky/commit-msg` runs **commitlint** on the message file. Allowed types are enumerated in `commitlint.config.cjs` (`feat`, `fix`, …, plus **`tweak`**, **`wip`**, **`locale`**).

---

## Testing, typecheck, and CI

- Root `npm run test`: all workspaces’ tests **plus** `scripts/list-dependencies.js` for `core`, `panel`, `nui`, `shared` (dependency allowlist / reporting — read `scripts/list-dependencies.js` before changing).
- `shared` workspace test script is a no-op echo (see `shared/package.json`).
- CI workflow: `.github/workflows/run-tests.yml` — tests on Ubuntu; build matrix on **Ubuntu + Windows + macOS**; creates a minimal `.env` with `TXDEV_FXSERVER_PATH` and `TXDEV_VITE_URL` for build; uses `npm install --include=optional` on macOS to work around npm optional-deps bug noted in the workflow comments.

---

## Licensing and third-party output

- License: **MIT** (`LICENSE` — copyright holder name appears as **SomeAussieGamer** in the license text; `package.json` author is **SomeAussieGaymer** — inconsistent strings, both in-repo facts).
- `npm run license:distfile` writes `monitor/THIRD-PARTY-LICENSES.txt` via `generate-license-file` (root `package.json` script).

---

## API / OpenAPI

- Generator entry: `npm run openapi:generate` → `npx tsx scripts/generate-openapi.ts`.
- Committed artifact: `docs/openapi.json` (exists in repo).

---

## Contributing workflow (from `docs/CONTRIBUTING.md` only)

- Discuss significant work on Discord (link in `docs/README.md` / `CONTRIBUTING.md`).
- PRs should target branch **`dev`** per `CONTRIBUTING.md`.
- **Note**: `.github/workflows/run-tests.yml` triggers on **`push` to `master`** and PRs to any branch — if default branch naming differs in a fork, **ask the maintainers** which branch is canonical for merges.

---

## Documentation gaps (facts)

- **`docs/development.md`** is still referenced in an error string in `scripts/build/dev.ts`, but **that file is not present** under `docs/` in this tree (only `README.md`, `CONTRIBUTING.md`, `theme.md`, `openapi.json` are present here). Equivalent material lives in **[fxPanel-Docs](https://github.com/SomeAussieGaymer/fxPanel-Docs/tree/main)** (by version) and on **[fxpanel.org/docs](https://fxpanel.org/docs)**; do not invent missing file contents.

---

## Cursor / GitHub agent files

Under `.github/agents/` there are multiple `*.agent.md` role files (Designer, Coder, Reviewer*, etc.). They are **editor/agent prompts**, not executable specs — read them if your tooling loads them.

---

## Duplicate `scripts/package.json`

A `scripts/package.json` file exists with similar `name`, `workspaces`, and scripts to the **repository root** `package.json`, but **different Husky setup** (`"prepare": "husky install"` vs root `"prepare": "husky"`). Normal installs use the **root** `package.json`. Treat the copy under `scripts/` as **possibly stale or auxiliary** unless a maintainer confirms a workflow that treats `scripts/` as its own npm project root.

---

## When you (the AI) must stop and ask a human

Ask the project owners when:

- Product or legal claims need confirmation (fxPanel compatibility depth, release readiness, etc.).
- Git default branch / release process conflicts with `CONTRIBUTING.md` or CI.
- You need intent behind **version skew** (folder name vs `package.json` version vs Git tag).
- You are unsure how **`scripts/package.json`** is meant to relate to the root manifest in your branch.

---

## Maintenance

When build pipelines, ports, env vars, workspaces, or hooks change, **update this file in the same PR**. Stale Motherdoc is worse than none.
