import { KickAllIcon } from '@/components/KickIcons';
import { fxRunnerStateAtom, txConfigStateAtom } from '@/hooks/status';
import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';
import { useAtomValue } from 'jotai';
import { MegaphoneIcon, PowerIcon, PowerOffIcon, RotateCcwIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOpenConfirmDialog, useOpenPromptDialog } from '@/hooks/dialogs';
import { ApiTimeout, useBackendApi } from '@/hooks/fetch';
import { useCloseAllSheets } from '@/hooks/sheets';
import { useAdminPerms } from '@/hooks/auth';
import { TxConfigState } from '@shared/enums';

const controlButtonsVariants = cva(
    `h-10 sm:h-8 rounded-md transition-colors
    flex grow items-center justify-center shrink-0
    border bg-muted shadow-xs

    focus:outline-hidden disabled:opacity-50 ring-offset-background  focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`,
    {
        variants: {
            type: {
                default: 'hover:bg-primary hover:text-primary-foreground hover:border-primary',
                destructive: 'hover:bg-destructive hover:text-destructive-foreground hover:border-destructive',
                warning: 'hover:bg-warning hover:text-warning-foreground hover:border-warning',
                success: 'hover:bg-success hover:text-success-foreground hover:border-success',
                info: 'hover:bg-info hover:text-info-foreground hover:border-info',
            },
        },
        defaultVariants: {
            type: 'default',
        },
    },
);

export default function ServerControls() {
    const txConfigState = useAtomValue(txConfigStateAtom);
    const fxRunnerState = useAtomValue(fxRunnerStateAtom);
    const openConfirmDialog = useOpenConfirmDialog();
    const openPromptDialog = useOpenPromptDialog();
    const closeAllSheets = useCloseAllSheets();
    const { hasPerm } = useAdminPerms();
    const fxsControlApi = useBackendApi({
        method: 'POST',
        path: '/fxserver/controls',
    });
    const fxsCommandsApi = useBackendApi({
        method: 'POST',
        path: '/fxserver/commands',
    });

    const handleServerControl = (action: 'start' | 'stop' | 'restart') => {
        const messageMap = {
            start: 'Starting server',
            stop: 'Stopping server',
            restart: 'Restarting server',
        };
        const toastLoadingMessage = `${messageMap[action]}...`;
        const callApi = () => {
            closeAllSheets();
            fxsControlApi({
                data: { action },
                toastLoadingMessage,
                timeout: ApiTimeout.LONG,
            });
        };
        if (action === 'start') {
            callApi();
        } else {
            openConfirmDialog({
                title: messageMap[action],
                message: `Are you sure you want to ${action} the server?`,
                onConfirm: callApi,
            });
        }
    };
    const handleStartStop = () => {
        handleServerControl(fxRunnerState.isIdle ? 'start' : 'stop');
    };
    const handleRestart = () => {
        if (!fxRunnerState.isChildAlive) return;
        handleServerControl('restart');
    };

    const handleAnnounce = () => {
        if (!fxRunnerState.isChildAlive) return;
        openPromptDialog({
            title: 'Send Announcement',
            message: 'Type the message to be broadcasted to all players.',
            placeholder: 'announcement message',
            submitLabel: 'Send',
            required: true,
            onSubmit: (input) => {
                closeAllSheets();
                fxsCommandsApi({
                    data: { action: 'admin_broadcast', parameter: input },
                    toastLoadingMessage: 'Sending announcement...',
                });
            },
        });
    };

    const handleKickAll = () => {
        if (!fxRunnerState.isChildAlive) return;
        openPromptDialog({
            title: 'Kick All Players',
            message: 'Type the kick reason or leave it blank (press enter)',
            placeholder: 'kick reason',
            submitLabel: 'Send',
            onSubmit: (input) => {
                closeAllSheets();
                fxsCommandsApi({
                    data: { action: 'kick_all', parameter: input },
                    toastLoadingMessage: 'Kicking players...',
                });
            },
        });
    };

    const hasControlPerms = hasPerm('control.server');
    const hasAnnouncementPerm = hasPerm('announcement');

    if (txConfigState !== TxConfigState.Ready) {
        return (
            <div className="h-8 w-full text-center font-light tracking-wider opacity-75">Server not configured.</div>
        );
    }
    return (
        <div className="flex flex-row justify-between gap-2">
            <Tooltip>
                <TooltipTrigger
                    type="button"
                    onClick={handleStartStop}
                    className={cn(
                        controlButtonsVariants({ type: fxRunnerState.isIdle ? 'success' : 'destructive' }),
                        fxRunnerState.isIdle && 'relative',
                    )}
                    disabled={!hasControlPerms}
                >
                    {fxRunnerState.isIdle && <span className="bg-success absolute inset-0 animate-pulse rounded blur-xs" />}
                    {fxRunnerState.isIdle ? <PowerIcon className="relative h-5" /> : <PowerOffIcon className="h-5" />}
                </TooltipTrigger>
                <TooltipContent className={cn(!hasControlPerms && 'text-destructive-inline text-center')}>
                    {hasControlPerms ? (
                        <p>{fxRunnerState.isIdle ? 'Start the server!' : 'Stop the server'}</p>
                    ) : (
                        <p>
                            You do not have permission <br />
                            to control the server.
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger
                    type="button"
                    onClick={handleRestart}
                    className={cn(controlButtonsVariants({ type: 'warning' }))}
                    disabled={!hasControlPerms || !fxRunnerState.isChildAlive}
                >
                    <RotateCcwIcon className="h-5" />
                </TooltipTrigger>
                <TooltipContent className={cn(!hasControlPerms && 'text-destructive-inline text-center')}>
                    {hasControlPerms ? (
                        <p>Restart Server</p>
                    ) : (
                        <p>
                            You do not have permission <br />
                            to control the server.
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger
                    type="button"
                    onClick={handleKickAll}
                    className={controlButtonsVariants()}
                    disabled={!hasControlPerms || !fxRunnerState.isChildAlive}
                >
                    <KickAllIcon style={{ height: '1.25rem', width: '1.5rem', fill: 'currentcolor' }} />
                </TooltipTrigger>
                <TooltipContent className={cn(!hasControlPerms && 'text-destructive-inline text-center')}>
                    {hasControlPerms ? (
                        <p>Kick All Players</p>
                    ) : (
                        <p>
                            You do not have permission <br />
                            to control the server.
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger
                    type="button"
                    onClick={handleAnnounce}
                    className={controlButtonsVariants()}
                    disabled={!hasAnnouncementPerm || !fxRunnerState.isChildAlive}
                >
                    <MegaphoneIcon className="h-5" />
                </TooltipTrigger>
                <TooltipContent className={cn(!hasAnnouncementPerm && 'text-destructive-inline text-center')}>
                    {hasAnnouncementPerm ? (
                        <p>Send Announcement</p>
                    ) : (
                        <p>
                            You do not have permission <br />
                            to send an Announcement.
                        </p>
                    )}
                </TooltipContent>
            </Tooltip>
        </div>
    );
}
