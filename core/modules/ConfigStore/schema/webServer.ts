import { z } from 'zod';
import { typeDefinedConfig } from './utils';
import { SYM_FIXER_DEFAULT } from '@lib/symbols';

const disableNuiSourceCheck = typeDefinedConfig({
    name: 'Disable NUI source IP check (production: leave off unless you accept spoofed in-game requests)',
    default: false,
    validator: z.boolean(),
    fixer: SYM_FIXER_DEFAULT,
});

const limiterMinutes = typeDefinedConfig({
    name: 'Rate Limiter Minutes',
    default: 15,
    validator: z.number().int().min(1),
    fixer: SYM_FIXER_DEFAULT,
});

const limiterAttempts = typeDefinedConfig({
    name: 'Rate Limiter Attempts',
    default: 10,
    validator: z.number().int().min(5),
    fixer: SYM_FIXER_DEFAULT,
});

const useSecureCookies = typeDefinedConfig({
    name: 'Use Secure Cookies',
    default: false,
    validator: z.boolean(),
    fixer: SYM_FIXER_DEFAULT,
});

const persistSessions = typeDefinedConfig({
    name: 'Persist Sessions to Disk',
    default: false,
    validator: z.boolean(),
    fixer: SYM_FIXER_DEFAULT,
});

/** When true, Koa trusts X-Forwarded-For / -Proto / -Host for ctx.ip, ctx.secure, ctx.host. */
const trustProxy = typeDefinedConfig({
    name: 'Trust reverse proxy (X-Forwarded-*)',
    default: false,
    validator: z.boolean(),
    fixer: SYM_FIXER_DEFAULT,
});

/**
 * Max IPs read from the end of X-Forwarded-For (Koa `maxIpsCount`). 0 keeps Koa default (full list).
 * Tune to the number of trusted proxy hops in front of the panel.
 */
const proxyTrustedHops = typeDefinedConfig({
    name: 'Proxy trusted hops (X-Forwarded-For tail)',
    default: 0,
    validator: z.number().int().min(0).max(10),
    fixer: SYM_FIXER_DEFAULT,
});

export default {
    disableNuiSourceCheck,
    limiterMinutes,
    limiterAttempts,
    useSecureCookies,
    persistSessions,
    trustProxy,
    proxyTrustedHops,
} as const;
