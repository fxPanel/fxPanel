export type TxAnchorHrefKind = 'external-http' | 'internal-path' | 'unsafe';

/**
 * Classify anchor href for TxAnchor / markdown: only http(s), protocol-relative https,
 * and same-origin paths starting with a single `/` are navigable; block javascript:, data:, etc.
 */
export function classifyTxAnchorHref(href: string): TxAnchorHrefKind {
    const t = href.trim();
    if (!t) return 'unsafe';

    const lower = t.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
        return 'unsafe';
    }
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
        return 'external-http';
    }
    // Protocol-relative: treat as external (resolved with https: when opening)
    if (t.startsWith('//') && !lower.startsWith('///')) {
        return 'external-http';
    }
    if (t.startsWith('/') && !t.startsWith('//')) {
        return 'internal-path';
    }
    return 'unsafe';
}
