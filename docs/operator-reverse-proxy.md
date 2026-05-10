# Reverse proxy and `X-Forwarded-*`

## Default behavior

By default, fxPanel keeps Koa **`proxy` disabled**. Node then uses the **direct TCP peer** (`req.socket.remoteAddress`) for `ctx.ip`, global HTTP rate limits keyed per IP, and related logging. **`X-Forwarded-For` is ignored** for client IP in that mode.

That avoids trivial IP spoofing when the panel is accidentally reachable without a sanitizing edge. The trade-off is that **behind a reverse proxy**, `ctx.ip` is often the **proxy’s** address, not the browser’s, until you opt in to trust proxy headers.

## Opt-in: `webServer.trustProxy` and `proxyTrustedHops`

When **`webServer.trustProxy`** is `true` in settings (backed by `txConfig.webServer.trustProxy`), the WebServer sets **`app.proxy = true`**, so Koa derives:

- **`ctx.ip`** from `X-Forwarded-For` (with `maxIpsCount` when **`webServer.proxyTrustedHops`** &gt; 0),
- **`ctx.secure`** / protocol from `X-Forwarded-Proto` where applicable,
- **`ctx.host`** from `X-Forwarded-Host` when present.

**Only enable this** when:

1. The panel is **not** directly exposed to untrusted clients on the HTTP port, and  
2. Your reverse proxy **strips or overwrites** inbound `X-Forwarded-*` from clients and sets them from the real connection.

Tune **`proxyTrustedHops`** to match how many trusted proxies append to `X-Forwarded-For` (see [Koa request.ip](https://github.com/koajs/koa/blob/master/docs/api/request.md#requestip)). When in doubt, leave **`trustProxy` off** and rely on firewall / VPN placement instead.

## TLS termination

If TLS terminates at the proxy, you typically want `X-Forwarded-Proto: https` and **`webServer.useSecureCookies`** / HTTPS-aware deployment so session cookies stay `Secure` where intended. Validate cookie flags on a staging deployment behind the same proxy you use in production.
