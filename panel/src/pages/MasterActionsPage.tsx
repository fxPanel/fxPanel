import { useReducer } from 'react';
import { useBackendApi } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { Button } from '@/components/ui/button';
import { Loader2Icon, ZapIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiTimeout } from '@/hooks/fetch';
import { PageHeader } from '@/components/page-header';
import { createDuplicateKeyResolver } from '@/lib/utils';

type CleanDbResp = {
    msElapsed?: number;
    playersRemoved?: number;
    actionsRemoved?: number;
    hwidsRemoved?: number;
    error?: string;
};

type RevokeWlResp = {
    msElapsed?: number;
    cntRemoved?: number;
    error?: string;
};

type MasterActionsState = {
    isCleaningDb: boolean;
    isRevokingWl: boolean;
    players: string;
    bans: string;
    warns: string;
    hwids: string;
    wlFilter: string;
};

const reduceMasterActionsState = (state: MasterActionsState, action: Partial<MasterActionsState>) => {
    return {
        ...state,
        ...action,
    };
};

const SELECT_CLASS = 'bg-secondary text-secondary-foreground w-full rounded-md border px-3 py-2 text-sm';

function GeneralActionsTab({ disableActions }: { disableActions: boolean }) {
    return (
        <TabsContent value="general" className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h3 className="font-semibold">Reset FXServer</h3>
                    <p className="text-warning text-sm">
                        This option has been moved to the{' '}
                        <a href="/settings#fxserver" className="text-warning font-bold underline">
                            Settings -&gt; FXServer
                        </a>{' '}
                        page.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => (window.location.href = '/settings#fxserver')}>
                    Go To Settings
                </Button>
            </div>

            <hr className="border-border" />

            <div className="flex items-center justify-between gap-4">
                <div>
                    <h3 className="font-semibold">Backup Database</h3>
                    <p className="text-muted-foreground text-sm">
                        Download a copy of the <code>playersDB.json</code> file containing all players and actions
                        (bans, warns and whitelists). You should do this every once in a while.
                    </p>
                </div>
                <Button
                    variant="destructive"
                    size="sm"
                    disabled={disableActions}
                    onClick={() => {
                        window.location.href = '/masterActions/backupDatabase';
                    }}
                >
                    Backup Database
                </Button>
            </div>
        </TabsContent>
    );
}

function CleanDatabaseTab({
    state,
    disableActions,
    onChange,
    onClean,
}: {
    state: Pick<MasterActionsState, 'players' | 'bans' | 'warns' | 'hwids' | 'isCleaningDb'>;
    disableActions: boolean;
    onChange: (state: Partial<MasterActionsState>) => void;
    onClean: () => void;
}) {
    return (
        <TabsContent value="cleandb" className="space-y-4 p-4">
            <div className="border-warning/30 bg-warning-hint rounded-lg border p-3 text-center text-sm">
                <strong>Warning:</strong> this action is irreversible and we strongly suggest that you save a database
                backup first.
            </div>

            <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                    <label className="pt-2 text-sm font-medium" htmlFor="clean-db-players">
                        Players
                    </label>
                    <div>
                        <select
                            id="clean-db-players"
                            className={SELECT_CLASS}
                            value={state.players}
                            onChange={(e) => onChange({ players: e.target.value })}
                        >
                            <option value="none">none</option>
                            <option value="60d">inactive over 60 days</option>
                            <option value="30d">inactive over 30 days</option>
                            <option value="15d">inactive over 15 days</option>
                        </select>
                        <p className="text-muted-foreground mt-1 text-xs">
                            Remove from the database players based on how much time since they last connected to the
                            server. This will not remove players with saved notes, neither will erase bans/warns/whitelist
                            logs.
                        </p>
                    </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                    <label className="pt-2 text-sm font-medium" htmlFor="clean-db-bans">
                        Bans
                    </label>
                    <div>
                        <select
                            id="clean-db-bans"
                            className={SELECT_CLASS}
                            value={state.bans}
                            onChange={(e) => onChange({ bans: e.target.value })}
                        >
                            <option value="none">none</option>
                            <option value="revoked">revoked</option>
                            <option value="revokedExpired">revoked or expired</option>
                            <option value="all">REMOVE ALL BANS</option>
                        </select>
                        <p className="text-muted-foreground mt-1 text-xs">Remove expired or revoked bans from the database.</p>
                    </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                    <label className="pt-2 text-sm font-medium" htmlFor="clean-db-warns">
                        Warns
                    </label>
                    <div>
                        <select
                            id="clean-db-warns"
                            className={SELECT_CLASS}
                            value={state.warns}
                            onChange={(e) => onChange({ warns: e.target.value })}
                        >
                            <option value="none">none</option>
                            <option value="revoked">revoked</option>
                            <option value="30d">older than 30 days</option>
                            <option value="15d">older than 15 days</option>
                            <option value="7d">older than 7 days</option>
                            <option value="all">REMOVE ALL WARNS</option>
                        </select>
                        <p className="text-muted-foreground mt-1 text-xs">Remove old or revoked warns from the database.</p>
                    </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                    <label className="pt-2 text-sm font-medium" htmlFor="clean-db-hwids">
                        HWIDs
                    </label>
                    <div>
                        <select
                            id="clean-db-hwids"
                            className={SELECT_CLASS}
                            value={state.hwids}
                            onChange={(e) => onChange({ hwids: e.target.value })}
                        >
                            <option value="none">none</option>
                            <option value="players">from players</option>
                            <option value="bans">from bans</option>
                            <option value="all">REMOVE ALL HWIDS</option>
                        </select>
                        <p className="text-muted-foreground mt-1 text-xs">
                            Player Hardware ID Tokens (HWIDs) are tied to the server owner. If you change your{' '}
                            <code>sv_licenseKey</code> to one owned by another person, it is recommended to wipe existing
                            HWIDs.
                        </p>
                    </div>
                </div>

                <div className="text-center">
                    <Button
                        variant="destructive"
                        size="sm"
                        disabled={disableActions || state.isCleaningDb}
                        onClick={onClean}
                    >
                        {state.isCleaningDb && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                        Clean Database
                    </Button>
                </div>
            </div>
        </TabsContent>
    );
}

function RevokeWhitelistsTab({
    wlFilter,
    isRevokingWl,
    disableActions,
    onChange,
    onRevoke,
}: {
    wlFilter: string;
    isRevokingWl: boolean;
    disableActions: boolean;
    onChange: (wlFilter: string) => void;
    onRevoke: () => void;
}) {
    return (
        <TabsContent value="revokewl" className="space-y-4 p-4">
            <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                <label className="pt-2 text-sm font-medium" htmlFor="revoke-whitelist-filter">
                    Filter
                </label>
                <div>
                    <select
                        id="revoke-whitelist-filter"
                        className={SELECT_CLASS}
                        value={wlFilter}
                        onChange={(e) => onChange(e.target.value)}
                    >
                        <option value="30d">players that haven't joined in the last 30 days</option>
                        <option value="15d">players that haven't joined in the last 15 days</option>
                        <option value="7d">players that haven't joined in the last 7 days</option>
                        <option value="all">REVOKE ALL WHITELISTS</option>
                    </select>
                    <p className="text-muted-foreground mt-1 text-xs">
                        Revoke whitelist from players that have not joined the server the last X days.
                        <br />
                        <strong>Note:</strong> This only applies to license whitelist, and not Discord member or Discord
                        role whitelist.
                    </p>
                </div>
            </div>

            <div className="text-center">
                <Button variant="destructive" size="sm" disabled={disableActions || isRevokingWl} onClick={onRevoke}>
                    {isRevokingWl && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                    Revoke Whitelists
                </Button>
            </div>
        </TabsContent>
    );
}

export default function MasterActionsPage() {
    const { hasPerm } = useAdminPerms();
    const isMasterAdmin = hasPerm('master');
    const isWebInterface = window.txConsts.isWebInterface;
    const disableActions = !(isMasterAdmin && isWebInterface);
    const openConfirmDialog = useOpenConfirmDialog();
    const getChangeKey = createDuplicateKeyResolver();
    const [state, dispatch] = useReducer(reduceMasterActionsState, {
        isCleaningDb: false,
        isRevokingWl: false,
        players: '60d',
        bans: 'revoked',
        warns: '30d',
        hwids: 'none',
        wlFilter: '30d',
    });
    const { isCleaningDb, isRevokingWl, players, bans, warns, hwids, wlFilter } = state;

    const cleanDbApi = useBackendApi<CleanDbResp>({
        method: 'POST',
        path: '/masterActions/cleanDatabase',
    });

    const revokeWlApi = useBackendApi<RevokeWlResp>({
        method: 'POST',
        path: '/masterActions/revokeWhitelists',
    });

    const handleCleanDb = () => {
        const changes: string[] = [];
        const playerLabels: Record<string, string> = {
            '60d': 'inactive over 60 days',
            '30d': 'inactive over 30 days',
            '15d': 'inactive over 15 days',
        };
        const banLabels: Record<string, string> = {
            revoked: 'revoked',
            revokedExpired: 'revoked or expired',
            all: 'REMOVE ALL BANS',
        };
        const warnLabels: Record<string, string> = {
            revoked: 'revoked',
            '30d': 'older than 30 days',
            '15d': 'older than 15 days',
            '7d': 'older than 7 days',
            all: 'REMOVE ALL WARNS',
        };
        const hwidLabels: Record<string, string> = {
            players: 'from players',
            bans: 'from bans',
            all: 'REMOVE ALL HWIDS',
        };

        if (players !== 'none') changes.push(`Remove players ${playerLabels[players]}.`);
        if (bans !== 'none') changes.push(`Remove bans ${banLabels[bans]}.`);
        if (warns !== 'none') changes.push(`Remove warns ${warnLabels[warns]}.`);
        if (hwids !== 'none') changes.push(`Remove HWIDs ${hwidLabels[hwids]}.`);

        if (!changes.length) {
            txToast.warning('You need to select at least one option.');
            return;
        }

        openConfirmDialog({
            title: 'Are you sure you want to:',
            message: (
                <ul className="mt-2 list-inside list-disc space-y-1">
                    {changes.map((change) => (
                        <li key={getChangeKey(change)}>{change}</li>
                    ))}
                </ul>
            ),
            actionLabel: 'Clean Database',
            onConfirm: () => {
                dispatch({ isCleaningDb: true });
                cleanDbApi({
                    data: { players, bans, warns, hwids },
                    timeout: ApiTimeout.LONG,
                    success(d) {
                        dispatch({ isCleaningDb: false });
                        if (d.error) {
                            txToast.error(d.error);
                        } else {
                            txToast.success(
                                `Players deleted: ${d.playersRemoved}\nActions deleted: ${d.actionsRemoved}\nHWIDs deleted: ${d.hwidsRemoved}\nFinished in ${d.msElapsed}ms.`,
                            );
                        }
                    },
                    error(msg) {
                        dispatch({ isCleaningDb: false });
                        txToast.error(msg);
                    },
                });
            },
        });
    };

    const handleRevokeWl = () => {
        const actionText =
            wlFilter === 'all'
                ? 'Revoke ALL Whitelists.'
                : `Revoke Whitelist from all players that have not joined in the past ${wlFilter}.`;

        openConfirmDialog({
            title: 'Are you sure you want to:',
            message: actionText,
            actionLabel: 'Revoke Whitelists',
            onConfirm: () => {
                dispatch({ isRevokingWl: true });
                revokeWlApi({
                    data: { filter: wlFilter },
                    timeout: ApiTimeout.LONG,
                    success(d) {
                        dispatch({ isRevokingWl: false });
                        if (d.error) {
                            txToast.error(d.error);
                        } else {
                            txToast.success(`Whitelists revoked: ${d.cntRemoved}\nFinished in ${d.msElapsed}ms.`);
                        }
                    },
                    error(msg) {
                        dispatch({ isRevokingWl: false });
                        txToast.error(msg);
                    },
                });
            },
        });
    };

    const defaultTab =
        window.location?.hash === '#cleandb'
            ? 'cleandb'
            : window.location?.hash === '#revokewl'
              ? 'revokewl'
              : 'general';

    return (
        <div className="mx-auto w-full max-w-(--breakpoint-md) space-y-4">
            <PageHeader icon={<ZapIcon />} title="Master Actions" />
            {!isMasterAdmin && (
                <div className="border-warning/30 bg-warning-hint rounded-lg border p-4 text-center text-sm">
                    <strong>Warning:</strong> You MUST be the Master Admin to be able to use the options below.
                </div>
            )}
            {!isWebInterface && (
                <div className="border-warning/30 bg-warning-hint rounded-lg border p-4 text-center text-sm">
                    <strong>Warning:</strong> These functions are disabled for the in-game menu, please use the Web
                    version.
                </div>
            )}

            <div className="border-destructive/30 rounded-lg border">
                <Tabs defaultValue={defaultTab}>
                    <TabsList className="w-full justify-start rounded-b-none border-b">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="cleandb">Clean Database</TabsTrigger>
                        <TabsTrigger value="revokewl">Revoke Whitelists</TabsTrigger>
                    </TabsList>

                    <GeneralActionsTab disableActions={disableActions} />
                    <CleanDatabaseTab
                        state={{ players, bans, warns, hwids, isCleaningDb }}
                        disableActions={disableActions}
                        onChange={dispatch}
                        onClean={handleCleanDb}
                    />
                    <RevokeWhitelistsTab
                        wlFilter={wlFilter}
                        isRevokingWl={isRevokingWl}
                        disableActions={disableActions}
                        onChange={(wlFilter) => dispatch({ wlFilter })}
                        onRevoke={handleRevokeWl}
                    />
                </Tabs>
            </div>
        </div>
    );
}
