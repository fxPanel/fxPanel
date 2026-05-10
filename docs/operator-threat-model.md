# Operator threat model (short)

This is a concise view of **what you are trusting** when you run fxPanel. It complements the code audit and deployment guides.

## Network and panel port

- The HTTP API and Socket.IO surface are **high value**: they can control the game server, files, deployer, and admin data.
- Prefer **binding to a non-public interface** or putting the panel **behind a VPN / SSH tunnel / authenticated reverse proxy**, not open to the entire Internet without compensating controls.
- See [operator-reverse-proxy.md](./operator-reverse-proxy.md) for `X-Forwarded-*` and **`webServer.trustProxy`**.

## TLS and cookies

- Session cookies are **httpOnly** and **sameSite=lax** by design; **`useSecureCookies`** should be on when users only reach the panel over HTTPS.
- Validate **HSTS**, **cookie flags**, and **CSP** on a real deployment behind your chosen TLS terminator.

## Discord and third-party tokens

- Bot tokens and OAuth secrets on disk are **sensitive**. Restrict filesystem and backup access to the profile directory.
- Treat Discord-linked admin resolution as part of your **identity boundary** (guild membership, role mappings).

## NUI and `webServer.disableNuiSourceCheck`

- In-game NUI talks to the panel with the **Lua intercom token** and identifier headers. **`disableNuiSourceCheck`** relaxes the “request must look local” rule for NUI auth.
- **Production:** leave **`disableNuiSourceCheck` off** unless you fully understand the risk (e.g. custom split networking). The settings UI label describes this. Misconfiguration can allow **spoofed in-game** traffic toward panel APIs that assume a local game server.

## Addons

- Approved addons run with **high trust** in-process on some platforms. Only install addons from **sources you trust**; treat them like installing arbitrary code next to the panel.

## Recipes and deployer

- Recipes can run **SQL and file tasks**. Treat any recipe URL or YAML like **arbitrary code**: only load from **trusted** hosts. The setup UI warns when using arbitrary recipe URLs; the headless deployer applies **basic URL allowlisting** for remote downloads (not a substitute for operator judgment).

## In-repo references

- Reverse proxy details: [operator-reverse-proxy.md](./operator-reverse-proxy.md)
- Contributing / dev setup: [CONTRIBUTING.md](./CONTRIBUTING.md)
