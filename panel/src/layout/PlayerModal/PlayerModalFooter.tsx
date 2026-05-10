import { useReducer } from 'react';
import { DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlayerModalRefType, useClosePlayerModal } from '@/hooks/playerModal';
import {
    AlertTriangleIcon,
    MailIcon,
    ShieldCheckIcon,
    HeartIcon,
    CameraIcon,
    MoreHorizontalIcon,
    Trash2Icon,
    EyeIcon,
} from 'lucide-react';
import { KickOneIcon } from '@/components/KickIcons';
import { useBackendApi, ApiTimeout } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { useOpenPromptDialog, useOpenConfirmDialog } from '@/hooks/dialogs';
import { GenericApiOkResp } from '@shared/genericApiTypes';
import { PlayerModalPlayerData } from '@shared/playerApiTypes';
import { useLocation, useRoute } from 'wouter';
import { useContentRefresh } from '@/hooks/pages';
import { useCloseAllSheets } from '@/hooks/sheets';
import ScreenshotDialog from './ScreenshotDialog';
import LiveSpectateDialog from './LiveSpectateDialog';
import type { AddonWidgetEntry } from '@/hooks/addons';
import { ErrorBoundary } from 'react-error-boundary';

type PlayerModalFooterProps = {
    playerRef: PlayerModalRefType;
    player?: PlayerModalPlayerData;
    addonActions?: AddonWidgetEntry[];
};

type PlayerModalFooterState = {
    screenshotOpen: boolean;
    screenshotData: string | null;
    screenshotLoading: boolean;
    screenshotError: string | null;
    spectateOpen: boolean;
    spectateSessionId: string | null;
    spectateError: string | null;
};

const reducePlayerModalFooterState = (state: PlayerModalFooterState, action: Partial<PlayerModalFooterState>) => {
    return {
        ...state,
        ...action,
    };
};

type PlayerFooterActionsProps = {
    player?: PlayerModalPlayerData;
    addonActions?: AddonWidgetEntry[];
    hasPerm: ReturnType<typeof useAdminPerms>['hasPerm'];
    onDm: () => void;
    onKick: () => void;
    onWarn: () => void;
    onGiveAdmin: () => void;
    onHeal: () => void;
    onScreenshot: () => void;
    onLiveSpectate: () => void;
    onDeletePlayer: () => void;
};

function PlayerFooterActions({
    player,
    addonActions,
    hasPerm,
    onDm,
    onKick,
    onWarn,
    onGiveAdmin,
    onHeal,
    onScreenshot,
    onLiveSpectate,
    onDeletePlayer,
}: PlayerFooterActionsProps) {
    return (
        <DialogFooter className="grid max-w-2xl grid-cols-2 gap-2 border-t p-2 sm:flex md:p-4">
            <Button
                variant="outline"
                size="sm"
                disabled={!hasPerm('players.direct_message') || !player || !player.isConnected}
                onClick={onDm}
                className="pl-2"
            >
                <MailIcon className="mr-1 h-5" /> DM
            </Button>
            <Button
                variant="outline"
                size="sm"
                disabled={!hasPerm('players.kick') || !player || !player.isConnected}
                onClick={onKick}
                className="pl-2"
            >
                <KickOneIcon
                    style={{
                        height: '1.25rem',
                        width: '1.75rem',
                        marginRight: '0.25rem',
                        fill: 'currentcolor',
                    }}
                />{' '}
                Kick
            </Button>
            <Button
                variant="outline"
                size="sm"
                disabled={!hasPerm('players.warn') || !player}
                onClick={onWarn}
                className="pl-2"
            >
                <AlertTriangleIcon className="mr-1 h-5" /> Warn
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={!player} className="pl-2">
                        <MoreHorizontalIcon className="mr-1 h-5" /> More
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={!hasPerm('manage.admins') || !player?.ids.length} onClick={onGiveAdmin}>
                        <ShieldCheckIcon className="mr-2 size-4" /> Give Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={!hasPerm('players.heal') || !player?.isConnected} onClick={onHeal}>
                        <HeartIcon className="mr-2 size-4" /> Heal
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={!hasPerm('players.spectate') || !player?.isConnected}
                        onClick={onScreenshot}
                    >
                        <CameraIcon className="mr-2 size-4" /> Screenshot
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={!hasPerm('players.spectate') || !player?.isConnected}
                        onClick={onLiveSpectate}
                    >
                        <EyeIcon className="mr-2 size-4" /> Watch Live
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        disabled={!hasPerm('players.delete') || !player?.isRegistered}
                        onClick={onDeletePlayer}
                        className="text-destructive focus:text-destructive"
                    >
                        <Trash2Icon className="mr-2 size-4" /> Delete Player
                    </DropdownMenuItem>
                    {addonActions && addonActions.length > 0 && (
                        <>
                            <DropdownMenuSeparator />
                            {addonActions.map((w) => (
                                <ErrorBoundary key={`${w.addonId}-${w.title}`} fallback={null}>
                                    <w.Component />
                                </ErrorBoundary>
                            ))}
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </DialogFooter>
    );
}

export default function PlayerModalFooter({ playerRef, player, addonActions }: PlayerModalFooterProps) {
    const { hasPerm } = useAdminPerms();
    const openPromptDialog = useOpenPromptDialog();
    const openConfirmDialog = useOpenConfirmDialog();
    const closeModal = useClosePlayerModal();
    const setLocation = useLocation()[1];
    const [isAlreadyInAdminPage] = useRoute('/admins');
    const refreshContent = useContentRefresh();
    const closeAllSheets = useCloseAllSheets();

    // Screenshot state
    const [state, dispatch] = useReducer(reducePlayerModalFooterState, {
        screenshotOpen: false,
        screenshotData: null,
        screenshotLoading: false,
        screenshotError: null,
        spectateOpen: false,
        spectateSessionId: null,
        spectateError: null,
    });
    const {
        screenshotOpen,
        screenshotData,
        screenshotLoading,
        screenshotError,
        spectateOpen,
        spectateSessionId,
        spectateError,
    } = state;

    const playerMessageApi = useBackendApi<GenericApiOkResp>({
        method: 'POST',
        path: `/player/message`,
    });
    const playerKickApi = useBackendApi<GenericApiOkResp>({
        method: 'POST',
        path: `/player/kick`,
    });
    const playerWarnApi = useBackendApi<GenericApiOkResp>({
        method: 'POST',
        path: `/player/warn`,
    });
    const playerHealApi = useBackendApi<GenericApiOkResp>({
        method: 'POST',
        path: `/player/heal`,
    });
    const playerScreenshotApi = useBackendApi<GenericApiOkResp & { imageData?: string }>({
        method: 'POST',
        path: `/player/screenshot`,
    });
    const playerDeleteApi = useBackendApi<GenericApiOkResp>({
        method: 'POST',
        path: `/player/delete_player`,
    });
    const liveSpectateStartApi = useBackendApi<GenericApiOkResp & { sessionId?: string }>({
        method: 'POST',
        path: `/player/liveSpectate/start`,
    });
    const liveSpectateStopApi = useBackendApi<GenericApiOkResp>({
        method: 'POST',
        path: `/player/liveSpectate/stop`,
    });

    const closeOnSuccess = (data: GenericApiOkResp) => {
        if ('success' in data) {
            closeModal();
            closeAllSheets();
        }
    };

    const handleGiveAdmin = () => {
        if (!player) return;
        const params = new URLSearchParams();
        params.set('autofill', 'true');
        params.set('name', player.pureName);
        for (const id of player.ids) {
            if (id.startsWith('discord:')) {
                params.set('discord', id);
            } else if (id.startsWith('fivem:')) {
                params.set('citizenfx', id);
            }
        }
        setLocation(`/admins?${params.toString()}`);
        if (isAlreadyInAdminPage) {
            refreshContent();
        }
        closeModal();
        closeAllSheets();
    };

    const handleDm = () => {
        if (!player) return;
        openPromptDialog({
            title: `Direct Message ${player.displayName}`,
            message: 'Type direct message below',
            placeholder: 'whatever you wanna say',
            submitLabel: 'Send',
            required: true,
            onSubmit: (input) => {
                playerMessageApi({
                    queryParams: playerRef,
                    data: { message: input },
                    genericHandler: { successMsg: 'Direct message sent.' },
                    toastLoadingMessage: 'Sending direct message...',
                    success: closeOnSuccess,
                });
            },
        });
    };

    const handleKick = () => {
        if (!player) return;
        openPromptDialog({
            title: `Kick ${player.displayName}`,
            message: 'Type the kick reason or leave it blank (press enter)',
            placeholder: 'any reason you want',
            submitLabel: 'Send',
            onSubmit: (input) => {
                playerKickApi({
                    queryParams: playerRef,
                    data: { reason: input },
                    genericHandler: { successMsg: 'Player kicked.' },
                    toastLoadingMessage: 'Kicking player...',
                    success: closeOnSuccess,
                });
            },
        });
    };

    const handleWarn = () => {
        if (!player) return;
        openPromptDialog({
            title: `Warn ${player.displayName}`,
            message: (
                <p>
                    Type below the warn reason. <br />
                    Offline players will receive the warning when they come back online.
                </p>
            ),
            placeholder: 'The reason for the warn, rule violated, etc.',
            submitLabel: 'Send',
            required: true,
            onSubmit: (input) => {
                playerWarnApi({
                    queryParams: playerRef,
                    data: { reason: input },
                    genericHandler: { successMsg: 'Warning sent.' },
                    toastLoadingMessage: 'Sending warning...',
                    success: closeOnSuccess,
                });
            },
        });
    };

    const handleHeal = () => {
        if (!player) return;
        playerHealApi({
            queryParams: playerRef,
            data: {},
            genericHandler: { successMsg: `Healed ${player.displayName}.` },
            toastLoadingMessage: 'Healing player...',
        });
    };

    const handleScreenshot = () => {
        if (!player) return;
        dispatch({
            screenshotData: null,
            screenshotError: null,
            screenshotLoading: true,
            screenshotOpen: true,
        });
        playerScreenshotApi({
            queryParams: playerRef,
            data: {},
            timeout: ApiTimeout.REALLY_REALLY_LONG,
            success: (data: any) => {
                dispatch({ screenshotLoading: false });
                if (data.imageData) {
                    dispatch({ screenshotData: data.imageData });
                } else if (data.error) {
                    dispatch({ screenshotError: data.error });
                }
            },
            error: (errorMsg) => {
                dispatch({
                    screenshotLoading: false,
                    screenshotError: typeof errorMsg === 'string' ? errorMsg : 'Failed to capture screenshot.',
                });
            },
        });
    };

    const handleLiveSpectate = () => {
        if (!player) return;
        dispatch({
            spectateError: null,
            spectateSessionId: null,
            spectateOpen: true,
        });
        liveSpectateStartApi({
            queryParams: playerRef,
            data: {},
            timeout: ApiTimeout.LONG,
            success: (data: any) => {
                if (data.sessionId) {
                    dispatch({ spectateSessionId: data.sessionId });
                } else if (data.error) {
                    dispatch({ spectateError: data.error });
                }
            },
            error: (errorMsg) => {
                dispatch({
                    spectateError: typeof errorMsg === 'string' ? errorMsg : 'Failed to start live spectate.',
                });
            },
        });
    };

    const handleStopSpectate = () => {
        if (spectateSessionId) {
            liveSpectateStopApi({
                data: { sessionId: spectateSessionId },
            });
        }
        dispatch({ spectateSessionId: null, spectateOpen: false });
    };

    const handleDeletePlayer = () => {
        if (!player) return;
        openConfirmDialog({
            title: `Delete Player`,
            message: (
                <p>
                    Are you sure you want to permanently delete <strong>{player.displayName}</strong> from the database?
                    <br />
                    This will remove all their data including play time, join date, notes, and identifier history.
                    <br />
                    <strong>This action cannot be undone.</strong>
                </p>
            ),
            onConfirm: () => {
                playerDeleteApi({
                    queryParams: playerRef,
                    data: {},
                    genericHandler: { successMsg: 'Player deleted from database.' },
                    toastLoadingMessage: 'Deleting player...',
                    success: (data) => {
                        if ('success' in data) {
                            closeModal();
                            closeAllSheets();
                        }
                    },
                });
            },
        });
    };

    return (
        <>
            <PlayerFooterActions
                player={player}
                addonActions={addonActions}
                hasPerm={hasPerm}
                onDm={handleDm}
                onKick={handleKick}
                onWarn={handleWarn}
                onGiveAdmin={handleGiveAdmin}
                onHeal={handleHeal}
                onScreenshot={handleScreenshot}
                onLiveSpectate={handleLiveSpectate}
                onDeletePlayer={handleDeletePlayer}
            />
            <ScreenshotDialog
                open={screenshotOpen}
                onOpenChange={(open) => dispatch({ screenshotOpen: open })}
                imageData={screenshotData}
                loading={screenshotLoading}
                error={screenshotError}
                playerName={player?.displayName ?? ''}
            />
            <LiveSpectateDialog
                open={spectateOpen}
                onOpenChange={(open) => dispatch({ spectateOpen: open })}
                sessionId={spectateSessionId}
                playerName={player?.displayName ?? ''}
                onStop={handleStopSpectate}
                error={spectateError}
            />
        </>
    );
}
