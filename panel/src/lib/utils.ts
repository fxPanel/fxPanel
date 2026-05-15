import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Socket, io } from 'socket.io-client';
import type { BanDurationType } from '@shared/otherTypes';
import { ListenEventsMap } from '@shared/socketioTypes';

/**
 * clsx then tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Creates deterministic sibling keys when stable content can repeat.
 */
export const createDuplicateKeyResolver = () => {
    const counts = new Map<string, number>();

    return (baseKey: string) => {
        const occurrence = counts.get(baseKey) ?? 0;
        counts.set(baseKey, occurrence + 1);
        return `${baseKey}:${occurrence}`;
    };
};

/**
 * Removes the indentation of multiline strings based on the minimum length of indentation
 */
export const stripIndent = (src: string) => {
    const indentSearchRegex = /^[ \t]*(?=\S)/gm;
    const indents = src.substring(src.indexOf('\n')).match(indentSearchRegex);
    if (!indents) return src;
    const minIndent = indents.reduce((r, a) => Math.min(r, a.length), Infinity);
    const indentRemoverRegex = new RegExp(`^[ \\t]{${minIndent}}`, 'gm');
    return src.replace(indentRemoverRegex, '');
};

/**
 * Converts a number to a locale string with commas and decimals
 */
export const numberToLocaleString = (num: number, decimals = 0) => {
    return num.toLocaleString(window.txBrowserLocale, { maximumFractionDigits: decimals });
};

/**
 * Returns a singleton socket.io client instance.
 * The socket connects with status (and playerlist for web) rooms.
 * Use joinSocketRoom/leaveSocketRoom to dynamically join/leave additional rooms.
 */
let mainSocket: Socket<ListenEventsMap, any> | null = null;
const subscribedRooms = new Set<string>();

export const destroySocket = () => {
    if (mainSocket) {
        mainSocket.disconnect();
        mainSocket = null;
    }
    subscribedRooms.clear();
};

export const getSocket = () => {
    if (mainSocket) return mainSocket;

    const rooms = window.txConsts.isWebInterface ? 'status,playerlist' : 'status';
    const socketOpts = {
        transports: ['polling'],
        upgrade: false,
        query: {
            rooms,
            uiVersion: window.txConsts.txaVersion,
        },
    };

    const socket = window.txConsts.isWebInterface
        ? io({ ...socketOpts, path: '/socket.io' })
        : io('monitor', { ...socketOpts, path: '/WebPipe/socket.io' });

    mainSocket = socket as Socket<ListenEventsMap, any>;

    //Re-join dynamic rooms on reconnect
    mainSocket.on('connect', () => {
        for (const room of subscribedRooms) {
            mainSocket!.emit('joinRoom', room);
        }
    });

    return mainSocket;
};

export const joinSocketRoom = (roomName: string) => {
    subscribedRooms.add(roomName);
    const socket = getSocket();
    if (socket.connected) {
        socket.emit('joinRoom', roomName);
    }
};

export const leaveSocketRoom = (roomName: string) => {
    subscribedRooms.delete(roomName);
    const socket = getSocket();
    if (socket.connected) {
        socket.emit('leaveRoom', roomName);
    }
};

/**
 * Returns a deterministic hsl() color based on a seed string
 */
const createSeedHslColor = (seed: string, alpha?: number) => {
    const hash = seed.split('').reduce((acc, char) => {
        return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0);
    const hue = Math.abs(hash % 360);
    return typeof alpha === 'number' ? `hsla(${hue}, 100%, 50%, ${alpha})` : `hsl(${hue}, 100%, 50%)`;
};

/**
 * Copy text to clipboard.
 * Only if on web, attempt to use the Clipboard API. If it fails, fallback to the old method.
 * Because we don't have access to Clipboard API in FiveM's CEF, as well as on
 * non-localhost origins without https, we need to use the old school method.
 * It does seem to work on Firefox though.
 */
export const copyToClipboard = async (
    value: string,
    surrogate: HTMLDivElement,
    returnFocusTo: HTMLElement | null = null,
) => {
    const copyViaApi = () => navigator.clipboard.writeText(value);
    const copyViaInput = () => {
        const clipElem = document.createElement('textarea');
        clipElem.id = 'clipboard-input-' + Math.random().toString(36).substring(2, 15);
        clipElem.value = value;
        Object.assign(clipElem.style, {
            position: 'fixed',
            opacity: '0',
            top: '0',
            left: '0',
        });
        surrogate.appendChild(clipElem);
        clipElem.select();
        const result = document.execCommand('copy');
        document.addEventListener(
            'copy',
            () => {
                setTimeout(() => {
                    try {
                        surrogate.removeChild(clipElem);
                        console.log('Removed clipboard temporary target:', clipElem.id);
                    } catch (error) {
                        console.log('Failed to remove clipboard temporary target:', clipElem.id);
                    } finally {
                        if (returnFocusTo) returnFocusTo.focus();
                    }
                }, 0);
            },
            {
                once: true,
                signal: AbortSignal.timeout(250),
            },
        );
        return result;
    };

    //try to prevent printing error on devtools
    if (window.txConsts.isWebInterface && navigator.clipboard) {
        try {
            return await copyViaApi();
        } catch (error1) {
            return copyViaInput();
        }
    } else {
        console.warn('Clipboard API not available, copying via textarea.');
        return copyViaInput();
    }
};

/**
 * Converts the duration object to a lowercase string with correct unit pluralization
 */
export const banDurationToString = (duration: BanDurationType) => {
    if (duration === 'permanent') return 'permanent';
    if (typeof duration === 'string') return duration;
    const pluralizedString = duration.value === 1 ? duration.unit.slice(0, -1) : duration.unit;
    return `${duration.value} ${pluralizedString}`;
};

/**
 * Converts the duration object to a short string
 */
export const banDurationToShortString = (duration: BanDurationType) => {
    if (typeof duration === 'string') {
        return duration === 'permanent' ? 'PERM' : duration;
    }

    let suffix: string;
    if (duration.unit === 'hours') {
        suffix = 'h';
    } else if (duration.unit === 'days') {
        suffix = 'd';
    } else if (duration.unit === 'weeks') {
        suffix = 'w';
    } else if (duration.unit === 'months') {
        suffix = 'mo';
    } else {
        suffix = duration.unit;
    }
    return `${duration.value}${suffix}`;
};
