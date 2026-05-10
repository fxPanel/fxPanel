import { TxConfigState } from '@shared/enums';
import { GlobalStatusType } from '@shared/socketioTypes';
import { atom, useAtomValue, useSetAtom } from 'jotai';

/**
 * Atoms
 */
export const globalStatusAtom = atom<GlobalStatusType | null>(null);
export const serverNameAtom = atom((get) => get(globalStatusAtom)?.server.name ?? 'unconfigured');
export const txConfigStateAtom = atom((get) => get(globalStatusAtom)?.configState ?? TxConfigState.Unkown);
export const fxRunnerStateAtom = atom(
    (get) =>
        get(globalStatusAtom)?.runner ?? {
            isIdle: true,
            isChildAlive: false,
        },
);
/**
 * Clock drift in seconds (serverTime - clientTime).
 * Positive means server clock is ahead of client.
 */
const clockDriftAtom = atom((get) => {
    const serverTime = get(globalStatusAtom)?.serverTime;
    if (!serverTime) return 0;
    return serverTime - Math.round(Date.now() / 1000);
});

/**
 * Hooks
 */
export const useSetGlobalStatus = () => {
    return useSetAtom(globalStatusAtom);
};

export const useGlobalStatus = () => {
    return useAtomValue(globalStatusAtom);
};

export const useClockDrift = () => {
    return useAtomValue(clockDriftAtom);
};
