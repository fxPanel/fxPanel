import { useReducer } from 'react';
import { useBackendApi, ApiTimeout } from '@/hooks/fetch';
import { useAdminPerms } from '@/hooks/auth';
import { txToast } from '@/components/TxToaster';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { Button } from '@/components/ui/button';
import { Loader2Icon } from 'lucide-react';
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

type DangerZoneState = {
    isCleaningDb: boolean;
    isRevokingWl: boolean;
    players: string;
    bans: string;
    warns: string;
    hwids: string;
    wlFilter: string;
};

const reduceDangerZoneState = (state: DangerZoneState, action: Partial<DangerZoneState>) => {
    return {
        ...state,
        ...action,
    };
};

const SELECT_CLASS = 'bg-secondary text-secondary-foreground w-full rounded-md border px-3 py-2 text-sm';

function DangerZoneAccessWarnings({ isMasterAdmin, isWebInterface }: { isMasterAdmin: boolean; isWebInterface: boolean }) {
    return (
        <>
            {!isMasterAdmin && (
                <div className="border-warning/30 bg-warning-hint rounded-lg border p-4 text-center text-sm">
                    <strong>Warning:</strong> You must be the Master Admin to use the options below.
                </div>
            )}
            {!isWebInterface && (
                <div className="border-warning/30 bg-warning-hint rounded-lg border p-4 text-center text-sm">
                    <strong>Warning:</strong> These functions are disabled for the in-game menu - please use the web
                    version.
                </div>
            )}
        </>
    );
}

function BackupDatabaseCard({ disabled }: { disabled: boolean }) {
    return (
        <div className="border-border/60 bg-card rounded-xl border">
            <div className="border-border/40 border-b px-5 py-3">
                <h3 className="font-semibold">Backup Database</h3>
                <p className="text-muted-foreground text-sm">
                    Download a copy of <code>playersDB.json</code> containing all players and actions.
                </p>
            </div>
            <div className="flex items-center justify-end px-5 py-4">
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={disabled}
                    onClick={() => {
                        window.open('/masterActions/backupDatabase', '_blank', 'noopener');
                    }}
                >
                    Backup Database
                </Button>
            </div>
        </div>
    );
}

export default function DangerZoneTab() {
    const { hasPerm } = useAdminPerms();
    const isMasterAdmin = hasPerm('master');
    const isWebInterface = window.txConsts.isWebInterface;
    const disableActions = !(isMasterAdmin && isWebInterface);
    const openConfirmDialog = useOpenConfirmDialog();
    const getChangeKey = createDuplicateKeyResolver();
    const [state, dispatch] = useReducer(reduceDangerZoneState, {
        isCleaningDb: false,
        isRevokingWl: false,
        players: 'none',
        bans: 'none',
        warns: 'none',
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

        const changes: string[] = [];
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
                                `Players deleted: ${d.playersRemoved ?? 0}\nActions deleted: ${d.actionsRemoved ?? 0}\nHWIDs deleted: ${d.hwidsRemoved ?? 0}\nFinished in ${d.msElapsed ?? 0}ms.`,
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
                            txToast.success(
                                `Whitelists revoked: ${d.cntRemoved ?? 0}\nFinished in ${d.msElapsed ?? 0}ms.`,
                            );
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

    return (
        <div className="space-y-6">
            <DangerZoneAccessWarnings isMasterAdmin={isMasterAdmin} isWebInterface={isWebInterface} />
            <BackupDatabaseCard disabled={disableActions} />

            {/* Revoke Whitelists */}
            <div className="border-destructive/30 bg-card rounded-xl border">
                <div className="border-border/40 border-b px-5 py-3">
                    <h3 className="font-semibold">Revoke Whitelists</h3>
                    <p className="text-muted-foreground text-sm">
                        Revoke whitelist from players that haven't joined recently. Only applies to license whitelist
                        - not Discord member or role whitelist.
                    </p>
                </div>
                <div className="space-y-4 p-5">
                    <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
                        <label htmlFor="wl-filter-select" className="pt-2 text-sm font-medium">
                            Filter
                        </label>
                        <div>
                            <select
                                id="wl-filter-select"
                                className={SELECT_CLASS}
                                value={wlFilter}
                                onChange={(e) => dispatch({ wlFilter: e.target.value })}
                            >
                                <option value="30d">players that haven't joined in the last 30 days</option>
                                <option value="15d">players that haven't joined in the last 15 days</option>
                                <option value="7d">players that haven't joined in the last 7 days</option>
                                <option value="all">REVOKE ALL WHITELISTS</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={disableActions || isRevokingWl}
                            onClick={handleRevokeWl}
                        >
                            {isRevokingWl && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                            Revoke Whitelists
                        </Button>
                    </div>
                </div>
            </div>

            {/* Clean Database */}
            <div className="border-destructive/30 bg-card rounded-xl border">
                <div className="border-border/40 border-b px-5 py-3">
                    <h3 className="font-semibold">Clean Database</h3>
                    <p className="text-muted-foreground text-sm">
                        Permanently remove players and actions from the database. This action is{' '}
                        <strong>irreversible</strong> - save a backup first.
                    </p>
                </div>
                <div className="space-y-4 p-5">
                    <div className="border-warning/30 bg-warning-hint rounded-lg border p-3 text-center text-sm">
                        <strong>Warning:</strong> this action is irreversible. Save a database backup first.
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
                        <label htmlFor="clean-db-players-select" className="pt-2 text-sm font-medium">
                            Players
                        </label>
                        <div>
                            <select
                                id="clean-db-players-select"
                                className={SELECT_CLASS}
                                value={players}
                                onChange={(e) => dispatch({ players: e.target.value })}
                            >
                                <option value="none">none</option>
                                <option value="60d">inactive over 60 days</option>
                                <option value="30d">inactive over 30 days</option>
                                <option value="15d">inactive over 15 days</option>
                            </select>
                            <p className="text-muted-foreground mt-1 text-xs">
                                Remove players based on time since last connection. Does not affect players with notes,
                                bans, warns, or whitelist logs.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
                        <label htmlFor="clean-db-bans-select" className="pt-2 text-sm font-medium">
                            Bans
                        </label>
                        <div>
                            <select
                                id="clean-db-bans-select"
                                className={SELECT_CLASS}
                                value={bans}
                                onChange={(e) => dispatch({ bans: e.target.value })}
                            >
                                <option value="none">none</option>
                                <option value="revoked">revoked</option>
                                <option value="revokedExpired">revoked or expired</option>
                                <option value="all">REMOVE ALL BANS</option>
                            </select>
                            <p className="text-muted-foreground mt-1 text-xs">Remove expired or revoked bans.</p>
                        </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
                        <label htmlFor="clean-db-warns-select" className="pt-2 text-sm font-medium">
                            Warns
                        </label>
                        <div>
                            <select
                                id="clean-db-warns-select"
                                className={SELECT_CLASS}
                                value={warns}
                                onChange={(e) => dispatch({ warns: e.target.value })}
                            >
                                <option value="none">none</option>
                                <option value="revoked">revoked</option>
                                <option value="30d">older than 30 days</option>
                                <option value="15d">older than 15 days</option>
                                <option value="7d">older than 7 days</option>
                                <option value="all">REMOVE ALL WARNS</option>
                            </select>
                            <p className="text-muted-foreground mt-1 text-xs">Remove old or revoked warns.</p>
                        </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
                        <label htmlFor="clean-db-hwids-select" className="pt-2 text-sm font-medium">
                            HWIDs
                        </label>
                        <div>
                            <select
                                id="clean-db-hwids-select"
                                className={SELECT_CLASS}
                                value={hwids}
                                onChange={(e) => dispatch({ hwids: e.target.value })}
                            >
                                <option value="none">none</option>
                                <option value="players">from players</option>
                                <option value="bans">from bans</option>
                                <option value="all">REMOVE ALL HWIDS</option>
                            </select>
                            <p className="text-muted-foreground mt-1 text-xs">
                                HWID tokens are tied to your <code>sv_licenseKey</code> owner. Wipe if transferring to a
                                different license key owner.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={disableActions || isCleaningDb}
                            onClick={handleCleanDb}
                        >
                            {isCleaningDb && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                            Clean Database
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
