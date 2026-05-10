import { describe, it, expect } from 'vitest';
import { assertSafeRemoteRecipeUrl } from './remoteRecipeDownloadUrl';

describe('assertSafeRemoteRecipeUrl', () => {
    it('accepts public https URLs', () => {
        const u = assertSafeRemoteRecipeUrl('https://example.com/recipe.yaml');
        expect(u.hostname).toBe('example.com');
    });

    it('rejects non-http(s) schemes', () => {
        expect(() => assertSafeRemoteRecipeUrl('file:///etc/passwd')).toThrow();
        expect(() => assertSafeRemoteRecipeUrl('ftp://example.com/a')).toThrow();
    });

    it('rejects private IPv4 over https', () => {
        expect(() => assertSafeRemoteRecipeUrl('https://192.168.1.1/r.yaml')).toThrow();
        expect(() => assertSafeRemoteRecipeUrl('https://10.0.0.1/r.yaml')).toThrow();
    });

    it('allows http only on loopback', () => {
        expect(() => assertSafeRemoteRecipeUrl('http://192.168.1.1/r.yaml')).toThrow();
        const u = assertSafeRemoteRecipeUrl('http://127.0.0.1/r.yaml');
        expect(u.hostname).toBe('127.0.0.1');
    });

    it('rejects credentials in URL', () => {
        expect(() => assertSafeRemoteRecipeUrl('https://user:pass@example.com/r.yaml')).toThrow();
    });
});
