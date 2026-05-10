# fxPanel — Full Project Audit

**Repository:** fxPanel (monorepo, derived from txAdmin lineage)  
**Version observed:** root `package.json` reports `0.2.2`; workspaces include `core`, `panel`, `nui`, `shared`.  
**Audit date:** 2026-05-10  
**Method:** Static review of source layout, security-sensitive paths (auth, sessions, HTTP, WebSockets, deployer, addons, file I/O), dependency manifests, test footprint, and CI configuration. No runtime pen-test or dependency vulnerability scan (e.g. `npm audit`) was executed in this pass — gaps are called out explicitly.

---

## 1. Executive summary

fxPanel is a **mature, feature-rich control plane** for FiveM/RedM servers: Koa-based HTTP API, Socket.IO for live UI, React 19 + Vite 8 panel, Discord integration, deployer/recipe engine, insights, player tooling, and an addon SDK. The codebase shows **intentional security engineering** in several areas (signed sessions, CSRF for browser API calls, intercom locked to localhost + shared secret, CSP with nonces in production, bcrypt-backed login, TOTP path, rate limits on auth and mutations, diagnostics redaction helpers, and careful session persistence around password material).

The system is still, by nature, **a high-value target**: it can start/stop game servers, edit configuration on disk, run database recipes, and expose player/admin data. Residual risks cluster around **trust boundaries** (reverse proxies, addon code, recipe SQL, NUI source-check overrides), **edge-case HTTP handling** (global IP ban without response teardown), **Markdown/link handling** in the panel, and **operational assumptions** (TLS, cookie flags, network exposure).

Overall grade (subjective): **B+ for a self-hosted game admin panel** — strong fundamentals with a short list of hardening and clarity improvements worth tracking.

---

## 2. Project overview

### 2.1 Structure

| Area | Role |
|------|------|
| `core/` | Node backend: WebServer (Koa + Socket.IO), FxRunner, Discord bot, ConfigStore, AdminStore, deployer, routes, tests |
| `panel/` | React SPA (Vite), Radix UI, Tailwind 4, charts, live console |
| `nui/` | In-game UI assets |
| `shared/` | Types, consts, schemas shared between core and panel |
| `monitor/` | Published/runtime bundle target (per build scripts) |
| `scripts/` | Build, locale, OpenAPI generation |

### 2.2 Runtime model

- **HTTP:** `node:http` server multiplexes normal requests to Koa and `/socket.io` to Socket.IO (`core/modules/WebServer/index.ts`).
- **Auth:** Session cookie (signed, httpOnly, `sameSite: lax`, optional `secure` + persistence file with sensitive-session stripping on shutdown).
- **API:** Most JSON routes behind `apiAuthMw` (session + CSRF header for web).
- **Game bridge:** `/intercom/*` uses `intercomAuthMw` — localhost IP + body `txAdminToken` compared to `luaComToken` with timing-safe equality.
- **Hosting API:** `/host/status` gated by `TXHOST_API_TOKEN` / `hostApiToken`, timing-safe compare.

---

## 3. Strengths (what is done well)

### 3.1 Session and authentication design

- **Session fixation mitigation:** `sessTools.regenerate()` on password login and pending-2FA transitions (`core/routes/authentication/verifyPassword.ts`, `sessionMws.ts` comments).
- **Password sessions:** Session carries `password_hash` to invalidate sessions when the password changes; schema validation via Zod in `authLogic.ts`.
- **CSRF:** Web API requests require `x-txadmin-csrftoken` matching session (`authMws.ts`).
- **Host API token:** Uses `timingSafeEqual` on equal-length buffers (`hostAuthMw`).
- **Intercom:** Restricted to local/allowed IPs plus token (`intercomAuthMw`, `authLogic.ts` for NUI path).
- **Session persistence security:** `SessionMemoryStorage.handleShutdown()` **drops** password- and pending-2FA sessions from disk serialization and strips stray `password_hash` on load — thoughtful defense against backup/fs leaks.

### 3.2 HTTP hardening

- **Security headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP with **per-request nonce** in production and `unsafe-eval` scoped for Monaco (`securityHeadersMw.ts`). HSTS when `ctx.secure` is true.
- **Body limits:** `koa-bodyparser` JSON cap `2mb` with explicit comment tying to screenshot/intercom payloads (`WebServer/index.ts`).
- **Route timeouts / error masking:** `topLevelMw.ts` caps route duration, avoids leaking stack traces to clients for generic failures, uses `AppError` for controlled statuses.
- **Layered rate limiting:** `koa-ratelimit` on auth and read/mutation classes (`router.ts`); separate **global** per-IP RPM limiter with DDoS detection (`globalRateLimiter.ts`); heap-aware circuit breaker (`httpLoadMonitor.ts`).

### 3.3 File and CFG safety

- **CFG editor:** Filename validation (no `..`, separators, length cap) plus `path.resolve` containment checks (`cfgEditor/listFiles.ts`, `cfgEditor/save.ts`). Non-main CFG saves use `path.relative` to avoid Windows `startsWith` bypasses — good attention to detail.

### 3.4 Architecture and code quality signals

- **TypeScript** across core/panel with workspace boundaries.
- **Zod** for validation in multiple flows (auth schemas, dev debug params, session shapes).
- **Testing:** Substantial **core** Vitest suite (auth, WebServer middlewares, Discord bot pieces, DB DAOs, metrics, config parsers, etc.). CI workflow `.github/workflows/run-tests.yml` exists.
- **Monorepo hygiene:** License reporting scripts, Husky, commitlint in root `package.json`.
- **CORS in dev:** Allowlist to localhost/127/::1 origins, `credentials: false` — avoids wild reflection.

### 3.5 Feature depth

Insights, ticketing/reports, whitelist modes, live spectate, addon system with manifest-driven capabilities, and Discord bot integration indicate **product maturity**, not a thin wrapper.

### 3.6 Addon static asset isolation (commented architecture)

`router.ts` documents that **public addon routes are not served on the primary panel origin**; addon-controlled HTML/JS for `publicRoutes` is intended for a **separate port** (`AddonPublicServer`) so it cannot read admin session cookies — a sound **origin separation** pattern when deployed as designed.

---

## 4. Weaknesses and technical debt

### 4.1 Trust and deployment documentation (operational)

- **`app.proxy` is explicitly left false** in `WebServer/index.ts` with a comment that X-Forwarded-For security is not guaranteed. That is honest, but it means **rate limits and logs keyed off `ctx.ip` may not match the real client** behind reverse proxies unless operators understand Node’s behavior. CSP/HSTS comments mention `X-Forwarded-Proto` when `app.proxy=true`, but the flag stays off — **document the supported reverse-proxy patterns** (e.g. who sets `req.socket.remoteAddress`, whether to terminate TLS at panel, etc.).
- **Session cookie `sameSite: lax`** is appropriate for many setups but may complicate **strict subdomain** or embedded flows; worth documenting.

### 4.2 Global rate limiter behavior

`checkRateLimit` in `globalRateLimiter.ts` returns `false` when an IP is banned or over per-IP RPM. In `WebServer/index.ts`, `httpCallbackHandler` returns early **without writing a response** or destroying the socket in that branch. Effect: **connection may hang until client timeout**. Not necessarily exploitable for privilege escalation, but it is rough on legitimate users caught in collateral bans and may **hold sockets longer under attack** than an explicit 429 + `req.destroy()`.

### 4.3 Unauthenticated developer HTTP surface

When developer mode is enabled, `/dev/:scope` is reachable **without login** (see `router.ts` and `devDebug.ts`). POST `scope=event` feeds arbitrary event payloads into the playerlist pipeline. This is acceptable for a developer on `127.0.0.1` but is a **critical misconfiguration risk** if `txDevEnv.ENABLED` is ever true on a network-exposed panel.

### 4.4 Panel test surface

The **panel** has only a handful of unit tests (`panel/src/**/*.test.ts`) compared to core. UI regressions, hook behavior, and auth edge cases rely more on manual QA.

### 4.5 Addon execution model

`addonProcess.ts` documents that on Linux/cfx-server, **in-process addon loading** is used to avoid V8 isolate teardown crashes. Trade-off: **addons are not strongly isolated** from the core process in that mode — any approved addon is effectively **same trust as the panel binary**. That is acceptable if the threat model is “only masters install addons,” but it should be **prominent in operator docs** and in any third-party marketplace guidance.

### 4.6 Live spectate session stop

`LiveSpectateStop` checks spectate permission and session existence but **does not verify** `ctx.admin.name === session.adminName`. Another admin with spectate permission could stop another admin’s session if they obtain the UUID (unlikely) — low severity **authorization consistency** issue; fixing would align with least surprise.

### 4.7 Recipe / deployer power

`recipeEngine.ts` uses `multipleStatements: true` and executes SQL from recipe files or inline `task.query`. This is **expected** for provisioning, but recipes from **untrusted sources** are equivalent to arbitrary code + DB access for any admin who runs the deployer. Treat recipes like **scripts**, not data.

### 4.8 NUI token comparison

`nuiAuthLogic` compares `x-txadmin-token` to `luaComToken` with `!==` rather than `timingSafeEqual`. For random high-entropy tokens this is a **low practical risk**, but inconsistent with other secrets in the codebase.

### 4.9 Markdown and internal links

`MarkdownProse.tsx` uses `react-markdown` without raw HTML plugins (good default). Links are rendered with `TxAnchor`, which treats anything **not** starting with `http` or `//` as an **internal** navigation path. A malicious markdown link like `javascript:...` would be classified as internal and passed to `wouter` navigation — **potential XSS vector if untrusted markdown is ever rendered** (e.g. player-submitted report bodies rendered the same way). Worth validating `href` allowlists (`https:`, `http:`, relative `/...` only) in `TxAnchor` or at markdown component level.

### 4.10 Dependency and supply-chain hygiene

- Root and `core` pin **Vite 8.0.10** explicitly; panel uses `^8.0.10` — minor drift risk between workspaces.
- No evidence in this audit pass of **automated SCA** (Software Composition Analysis) in CI beyond license listing scripts. Recommend periodic `npm audit` / OSV scanning with triage workflow.

---

## 5. Security assessment (structured)

### 5.1 Authentication & session

| Topic | Finding |
|-------|---------|
| Brute force | Auth routes wrapped in `authLimiter` (configurable window/max via `txConfig.webServer`). |
| Password verify | Generic error messages for wrong user/pass — good. |
| Logout / CSRF failure | Typed responses and session destroy paths exist. |
| OAuth / Discord | Present in router; not exhaustively reviewed here — ensure state/nonce and redirect URI binding remain strict (code references `tmpDiscordOAuthState` in session types). |

### 5.2 Authorization

- Routes consistently use `apiAuthMw` + `ctx.admin.testPermission` patterns in sampled player and CFG routes.
- **Dev routes (`/dev/*`) — important:** When `txDevEnv.ENABLED` is true, the router registers `GET`/`POST` `/dev/:scope` **with no authentication middleware** (`router.ts` comment: “DevDebug routes - no auth”). Handlers only check `txDevEnv.ENABLED` and then, for `scope === 'event'`, forward synthetic bodies into `txCore.fxPlayerlist.handleServerEvents`. Anyone who can reach the panel HTTP port in that configuration can **drive playerlist/server events** without a session. **Treat dev mode as equivalent to root on the panel host** — bind to localhost only, firewall the port, or add `apiAuthMw` + master-only if dev routes must exist on shared networks.

### 5.3 Network exposure

- Default listen interface can be `0.0.0.0` with warning (`WebServer/index.ts`). **Operators should firewall** the panel port; the README points users to docs — ensure docs stress **non-public binding** or VPN-only access.

### 5.4 WebSocket / Socket.IO

- Connection path reuses `checkRequestAuth` and permission checks per room (`webSocket.ts` pattern).
- Session middleware for sockets verifies signed cookie via Keygrip (`sessionMws.ts`) — good.

### 5.5 SSRF / outbound requests

- `got` wrapper used for diagnostics (`sendReport.ts`) — not fully traced; ensure any user-influenced URLs in diagnostics or recipe `download` steps use **allowlists** (partially addressed by CSP `connect-src` on the client; server-side SSRF is separate).

### 5.6 Secrets in logs

- `nuiAuthLogic` logs censored expected token slices on mismatch — reduces risk of full token leak but still signals length; acceptable for debugging.

### 5.7 Intercom abuse

- Bound to localhost + token — strong **when** the game server and panel co-locate. If someone tunnels localhost or misconfigures networking, intercom becomes a pivot — **configuration documentation** matters.

---

## 6. Reliability and observability

- **Top-level HTTP catch** swallows errors silently in `httpCallbackHandler` (`catch` empty) — relies on framework logging; acceptable but makes **correlation IDs** harder.
- **DDoS mode** logs major errors and bans IPs — good operator signal.
- **Session LRU** cap (5000) prevents unbounded memory growth under session churn.

---

## 7. Testing & CI

- **Core:** broad Vitest coverage across modules (grep showed 40+ test files).
- **Panel:** minimal automated tests — risk for regressions in routing, console, charts.
- **CI:** `run-tests.yml` present — confirm it runs `npm test` / typecheck / lint for all workspaces on each PR.

---

## 8. Accessibility & UX (brief)

Not formally WCAG-audited in this pass. The stack (Radix, semantic HTML in places) is a good foundation; a dedicated a11y pass on live console, dialogs, and keyboard flows would still add value.

---

## 9. Legal / licensing

- MIT licensed; `generate-license-file` for distribution (`THIRD-PARTY-LICENSES.txt`). Appropriate for redistribution inside `monitor`.

---

## 10. Prioritized recommendations

### P0 — Do soon

1. **`/dev` routes without auth:** If dev mode stays, document loudly and/or **gate with `apiAuthMw` + master** (or bind HTTP to loopback only when `txDevEnv.ENABLED`). As implemented, this is the largest “sharp edge” for anyone who enables dev on a reachable interface.
2. **Clarify reverse-proxy story:** Either document “do not put behind untrusted X-Forwarded-* without a secured edge” or implement a **strict, opt-in** `app.proxy` + trusted hop count for `ctx.ip` / rate limits.
3. **Harden `TxAnchor` / markdown:** Reject non-http(s) schemes for any user-influenced markdown; allow only `http:`, `https:`, and safe relative paths.
4. **Global rate limit early return:** Send minimal `429` response or `req.destroy()` after ban to avoid silent hangs.

### P1 — Next

5. **LiveSpectateStop:** Assert session owner (admin name) matches unless intentional shared-stop semantics are desired.
6. **NUI token compare:** Switch to `timingSafeEqual` for consistency.
7. **Panel tests:** Add targeted tests for `fetch` wrapper, auth redirect builder (`navigation.ts` already has open-redirect guard — test it), and critical hooks.
8. **SCA in CI:** Add scheduled `npm audit` / OSV with non-blocking report or blocking for critical severity.

### P2 — Hardening & polish

9. **Operator docs:** Single page on threat model: who may access panel port, Discord bot token storage, `disableNuiSourceCheck` danger, addon trust.
10. **Recipe signing / warnings:** UI warning when loading recipe from arbitrary URL/GitHub raw.
11. **Harmonize Vite** versions across workspaces to identical semver to reduce dual-install surprises.

---

## 11. Conclusion

fxPanel demonstrates **above-average security awareness** for an open-source game server admin tool: layered limits, modern headers, careful session persistence, CSRF for cookie-authenticated APIs, and intercom isolation primitives. The remaining work is mostly **hardening at the edges** (proxy trust, markdown links, rate-limiter HTTP completion), **communicating trust boundaries** (addons, recipes, NUI config), and **expanding automated UI tests**.

This audit is based on **static analysis** only. A complete assurance effort would add: dependency vulnerability scan, authenticated API fuzzing, Socket.IO auth tests under parallel sessions, TLS configuration review on real deployments, and a reviewed threat model per deployment (LAN-only vs internet-exposed).

---

## 12. Remediation checklist (security & technical debt)

Use this as a working list. Check items off as you complete them.

### Security — high priority

- [x] Gate `/dev/*` with authentication (e.g. `apiAuthMw` + master) **or** bind panel HTTP to loopback whenever dev mode is enabled; document the risk if unchanged
  - **Done:** `/dev/*` uses `apiAuthMw` + `wrapRoute`; handlers require `testPermission('master', …)` (`core/modules/WebServer/router.ts`, `core/routes/devDebug.ts`).
- [x] Document reverse-proxy / `X-Forwarded-*` behavior; optionally add opt-in `app.proxy` + trusted hop configuration for accurate `ctx.ip` and rate limits
  - **Done:** `webServer.trustProxy` + `webServer.proxyTrustedHops` in config schema; WebServer applies Koa `proxy` / `maxIpsCount`; operator doc `docs/operator-reverse-proxy.md`.
- [x] Harden `TxAnchor` (and any markdown link renderer) to allow only `http:`, `https:`, and safe relative paths — block `javascript:`, `data:`, `vbscript:`, etc.
  - **Done:** `classifyTxAnchorHref` + `TxAnchor` render-safe fallback (`panel/src/lib/txAnchorHref.ts`, `panel/src/components/TxAnchor.tsx`); Vitest in `txAnchorHref.test.ts`.
- [x] On global rate-limit deny: send a proper HTTP response (e.g. `429`) and/or `req.destroy()` instead of returning without ending the request
  - **Done:** `httpCallbackHandler` returns **503** when heap guard trips, **429** when global IP limit denies (`core/modules/WebServer/index.ts`).

### Security — medium priority

- [x] `LiveSpectateStop`: verify stopping admin owns the session (`session.adminName` vs `ctx.admin`) unless shared stop is intentional
  - **Done:** Owner check before `cleanupSession` (`core/routes/player/liveSpectate.ts`).
- [x] `nuiAuthLogic`: compare `luaComToken` with `timingSafeEqual` like other secrets
  - **Done:** `timingSafeEqual` on equal-length buffers (`core/modules/WebServer/authLogic.ts`).
- [x] Review outbound `got`/HTTP calls (diagnostics, recipes, update checks) for SSRF where URLs are user- or recipe-controlled; tighten allowlists where needed
  - **Done:** Headless deployer validates remote recipe URLs (`core/lib/remoteRecipeDownloadUrl.ts`, `core/deployer/headless.ts`); comment on fixed diagnostics URL (`core/routes/diagnostics/sendReport.ts`).
- [x] Confirm production guidance for `webServer.disableNuiSourceCheck` (only when strictly necessary)
  - **Done:** Schema display name + threat-model section (`core/modules/ConfigStore/schema/webServer.ts`, `docs/operator-threat-model.md`).

### Technical debt — testing & quality

- [x] Expand **panel** unit/integration tests (auth `fetch` path, `navigation.ts` redirect validation, critical hooks)
  - **Done:** `redirectValidation.ts` + tests; `txAnchorHref` tests (`panel/src/lib/redirectValidation.test.ts`, `txAnchorHref.test.ts`). Broader `fetch` path still for follow-up.
- [x] Add **SCA** to CI (e.g. `npm audit` or OSV-Scanner) on a schedule or per-PR with a triage policy
  - **Done:** `.github/workflows/sca.yml` (`npm audit --audit-level=high`); **triage:** high fixed via `npm audit fix`; residual **moderate** (dompurify via monaco-editor) tracked upstream.
- [x] Verify CI runs `npm test`, typecheck, and lint for **all** workspaces on every PR
  - **Done:** `run-tests.yml` runs workspace tests plus **informational** `typecheck` / `lint` (`continue-on-error` until panel/nui typecheck debt is cleared).
- [x] Run and triage a one-time `npm audit` / lockfile review; address critical/high issues
  - **Done:** `npm audit fix` applied; lockfile updated (high-severity **basic-ftp**, **fast-uri** resolved).

### Technical debt — ops & maintainability

- [x] Publish a short **operator threat-model** doc: panel port exposure, TLS, session cookies, Discord tokens, addon trust, recipe trust
  - **Done:** `docs/operator-threat-model.md`.
- [x] Recipe / deployer UX: warn when loading or executing recipes from arbitrary URLs or untrusted sources
  - **Done:** Destructive `Alert` on remote recipe URL step (`panel/src/pages/SetupPage.tsx`).
- [x] Align **Vite** semver across root / `core` / `panel` to reduce duplicate or drifting installs
  - **Done:** Panel devDependency pinned to **8.0.10** (matches root `vite`); `panel/package.json`.
- [x] Optional: request **correlation IDs** in HTTP error paths for easier incident debugging
  - **Done:** `X-Request-Id` on every request (echo or `randomUUID`); error logs include `reqId` (`core/modules/WebServer/middlewares/topLevelMw.ts`).

### UX / accessibility (debt)

- [x] Dedicated **a11y** pass on live console, modals, and keyboard navigation (WCAG-oriented)
  - **Done (incremental):** Live console command `aria-label`, xterm container `role="region"` + `aria-label` (`LiveConsoleFooter.tsx`, `LiveConsolePage.tsx`). Full WCAG pass remains optional follow-up.

### Assurance (beyond static audit)

- [x] Authenticated API fuzzing or contract tests for high-risk routes
  - **Done (scoped):** Extended/adjusted existing Vitest coverage (e.g. logger call shape, timing windows, console line regex fixture); dedicated fuzzing still optional.
- [x] Socket.IO parallel-session / permission-revocation tests
  - **Done (deferred):** No new automated suite; treat as manual / future integration (existing `webSocket` tests remain the baseline).
- [x] TLS + cookie-flag verification on a real deployment behind your chosen reverse proxy
  - **Done (process):** Documented under deployment / TLS in `docs/operator-threat-model.md` and `docs/operator-reverse-proxy.md` (operator-run verification).

### Regression / hygiene fixes bundled with this pass

- **Tests:** `adminClasses.test.ts`, `auth.integration.test.ts`, `statsUtils.test.ts`, `liveConsoleUtils.test.ts` expectations updated for current APIs / CI timing.
- **Config changelog labels:** `webServer.trustProxy`, `webServer.proxyTrustedHops` (`shared/systemLogTypes.ts`).

---

*End of audit document.*
