import { describe, it, expect } from 'vitest';
import { classifyTxAnchorHref } from './txAnchorHref';

describe('classifyTxAnchorHref', () => {
    it('classifies https and http as external', () => {
        expect(classifyTxAnchorHref('https://a.example/x')).toBe('external-http');
        expect(classifyTxAnchorHref('HTTP://a.example/x')).toBe('external-http');
    });

    it('classifies protocol-relative as external', () => {
        expect(classifyTxAnchorHref('//cdn.example/x')).toBe('external-http');
    });

    it('classifies single-slash paths as internal', () => {
        expect(classifyTxAnchorHref('/players')).toBe('internal-path');
    });

    it('rejects open redirect style paths', () => {
        expect(classifyTxAnchorHref('//evil.com')).toBe('external-http');
        expect(classifyTxAnchorHref('///evil')).toBe('unsafe');
    });

    it('rejects dangerous schemes', () => {
        expect(classifyTxAnchorHref('javascript:alert(1)')).toBe('unsafe');
        expect(classifyTxAnchorHref('data:text/html,<b>x</b>')).toBe('unsafe');
        expect(classifyTxAnchorHref('vbscript:msgbox(1)')).toBe('unsafe');
    });
});
