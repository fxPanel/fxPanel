import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isValidRedirectPath } from './redirectValidation';

describe('isValidRedirectPath', () => {
    beforeEach(() => {
        vi.stubGlobal('window', {
            location: { hostname: 'localhost', href: 'http://localhost:40120/' },
        });
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('accepts same-host absolute paths', () => {
        expect(isValidRedirectPath('/dashboard')).toBe(true);
    });

    it('rejects protocol-relative URLs', () => {
        expect(isValidRedirectPath('//evil.com/phish')).toBe(false);
    });

    it('rejects non-strings and empty', () => {
        expect(isValidRedirectPath('')).toBe(false);
        expect(isValidRedirectPath(null)).toBe(false);
    });
});
