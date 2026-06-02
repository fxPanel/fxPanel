import { useCallback, useMemo } from 'react';
import localeMap from '@shared/localeMap';

export const useLocale = () => {
    const currentLang = useMemo(() => {
        let lang = Array.isArray(window.txBrowserLocale)
            ? window.txBrowserLocale[0]
            : window.txBrowserLocale;

        // Try exact match first
        if (localeMap[lang]) {
            return lang;
        }

        // Try base language if region tag present (e.g., de-DE -> de)
        const baseLang = lang.split(/[-_]/)[0].toLowerCase();
        if (localeMap[baseLang]) {
            return baseLang;
        }

        // Fallback to English
        return 'en';
    }, []);

    const locale = useMemo(() => localeMap[currentLang], [currentLang]);

    const t = useCallback(
        (key: string, defaultValue?: string): string => {
            const keys = key.split('.');
            let value: any = locale;

            for (const k of keys) {
                if (typeof value === 'object' && value !== null && k in value) {
                    value = value[k];
                } else {
                    return defaultValue ?? key;
                }
            }

            return typeof value === 'string' ? value : defaultValue ?? key;
        },
        [locale],
    );

    return useMemo(() => ({ locale, currentLang, t }), [locale, currentLang, t]);
};
