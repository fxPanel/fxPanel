import { useMemo } from 'react';
import localeMap from '@shared/localeMap';

export const useLocale = () => {
    const currentLang = useMemo(() => {
        let lang = Array.isArray(window.txBrowserLocale)
            ? window.txBrowserLocale[0]
            : window.txBrowserLocale;

        if (!localeMap[lang]) {
            lang = 'en';
        }

        return lang;
    }, []);

    const locale = useMemo(() => localeMap[currentLang], [currentLang]);

    const t = (key: string, defaultValue?: string): string => {
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
    };

    return { locale, currentLang, t };
};
