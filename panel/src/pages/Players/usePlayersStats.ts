import { useEffect, useReducer } from 'react';
import { PlayersStatsResp } from '@shared/playerApiTypes';
import { useBackendApi } from '@/hooks/fetch';
import { isDevMockStatusOptInEnabled } from '@/lib/devFlags';

type PlayersStatsSuccess = Exclude<PlayersStatsResp, { error: string }>;

type PlayersStatsState = {
    stats: PlayersStatsSuccess | undefined;
    isLoading: boolean;
    error: Error | null;
};

type PlayersStatsAction =
    | { type: 'startLoading' }
    | { type: 'loadSuccess'; stats: PlayersStatsSuccess | undefined }
    | { type: 'loadError'; error: Error };

function reducePlayersStatsState(state: PlayersStatsState, action: PlayersStatsAction): PlayersStatsState {
    switch (action.type) {
        case 'startLoading':
            return {
                ...state,
                isLoading: true,
                error: null,
            };
        case 'loadSuccess':
            return {
                stats: action.stats,
                isLoading: false,
                error: null,
            };
        case 'loadError':
            return {
                stats: undefined,
                isLoading: false,
                error: action.error,
            };
        default:
            return state;
    }
}

export function usePlayersStats() {
    const [state, dispatch] = useReducer(reducePlayersStatsState, {
        stats: undefined,
        isLoading: true,
        error: null,
    });
    const { stats, isLoading, error } = state;
    const statsApi = useBackendApi<PlayersStatsResp>({
        method: 'GET',
        path: '/player/stats',
        abortOnUnmount: true,
    });

    useEffect(() => {
        let isMounted = true;
        dispatch({ type: 'startLoading' });
        const isDevMockMode = import.meta.env.DEV && isDevMockStatusOptInEnabled();
        if (isDevMockMode) {
            import('./devMockPlayers')
                .then(({ getMockPlayersStats }) => {
                    if (!isMounted) return;
                    const data = getMockPlayersStats();
                    if (data && 'error' in data) {
                        dispatch({ type: 'loadError', error: new Error(data.error) });
                    } else {
                        dispatch({ type: 'loadSuccess', stats: data });
                    }
                })
                .catch((err) => {
                    if (!isMounted) return;
                    dispatch({
                        type: 'loadError',
                        error: err instanceof Error ? err : new Error(String(err)),
                    });
                });
            return () => {
                isMounted = false;
            };
        }
        statsApi({
            success(data) {
                if (data && 'error' in data) {
                    dispatch({ type: 'loadError', error: new Error(data.error) });
                } else {
                    dispatch({ type: 'loadSuccess', stats: data });
                }
            },
            error(message) {
                dispatch({ type: 'loadError', error: new Error(message) });
            },
        });
    }, []);

    return { stats, isLoading, error };
}
