import { useEffect, useMemo, useReducer, useState } from 'react';
import {
    AdminRecentAction,
    AdminStatsEntry,
    ApiGetAdminActionsResp,
    ApiGetAdminStatsResp,
} from '@shared/adminApiTypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
    RotateCcwIcon,
    GavelIcon,
    AlertTriangleIcon,
    BarChart3Icon,
    Loader2Icon,
    Undo2Icon,
    ExternalLinkIcon,
    ChevronDownIcon,
    SearchIcon,
    LogOutIcon,
} from 'lucide-react';
import { useBackendApi } from '@/hooks/fetch';
import { useOpenPlayerModal } from '@/hooks/playerModal';
import { useOpenActionModal } from '@/hooks/actionModal';
import { tsToLocaleDateTimeString } from '@/lib/dateTime';

type SortMode = 'newest' | 'oldest' | 'name-az' | 'name-za';

const sortActions = (actions: AdminRecentAction[], sort: SortMode) => {
    const sorted = [...actions];
    switch (sort) {
        case 'newest':
            sorted.sort((a, b) => b.timestamp - a.timestamp);
            break;
        case 'oldest':
            sorted.sort((a, b) => a.timestamp - b.timestamp);
            break;
        case 'name-az':
            sorted.sort((a, b) => {
                const na = a.playerName || '';
                const nb = b.playerName || '';
                return na.localeCompare(nb);
            });
            break;
        case 'name-za':
            sorted.sort((a, b) => {
                const na = a.playerName || '';
                const nb = b.playerName || '';
                return nb.localeCompare(na);
            });
            break;
    }
    return sorted;
};

type AdminStatsDialogState = {
    fetchedStats: AdminStatsEntry | undefined;
    allActions: AdminRecentAction[] | null;
    actionsLoading: boolean;
};

const reduceAdminStatsDialogState = (state: AdminStatsDialogState, action: Partial<AdminStatsDialogState>) => {
    return {
        ...state,
        ...action,
    };
};

function ActionTypeSection({
    label,
    icon,
    colorClass,
    actions,
    onPlayerClick,
    onActionClick,
}: {
    label: string;
    icon: React.ReactNode;
    colorClass: string;
    actions: AdminRecentAction[];
    onPlayerClick: (action: AdminRecentAction) => void;
    onActionClick: (actionId: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortMode>('newest');

    const filtered = useMemo(() => {
        let list = actions;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (a) =>
                    (a.playerName && a.playerName.toLowerCase().includes(q)) ||
                    a.reason.toLowerCase().includes(q) ||
                    a.id.toLowerCase().includes(q),
            );
        }
        return sortActions(list, sort);
    }, [actions, search, sort]);

    return (
        <div className="overflow-hidden rounded-lg border">
            {/* Header - clickable to expand */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="hover:bg-muted/50 flex w-full cursor-pointer items-center justify-between px-3 py-2.5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-sm font-medium">{label}</span>
                    <span className={cn('text-lg font-bold', colorClass)}>{actions.length}</span>
                </div>
                <div className="flex items-center gap-3">
                    <ChevronDownIcon
                        className={cn('text-muted-foreground size-4 transition-transform', expanded && 'rotate-180')}
                    />
                </div>
            </button>

            {/* Expanded content */}
            {expanded && actions.length > 0 && (
                <div className="space-y-2 border-t px-3 py-2">
                    {/* Search + Sort controls */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <SearchIcon className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
                            <Input
                                placeholder="Search player or reason..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-8 pl-7 text-xs"
                            />
                        </div>
                        <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                            <SelectTrigger className="h-8 w-30 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest</SelectItem>
                                <SelectItem value="oldest">Oldest</SelectItem>
                                <SelectItem value="name-az">Name A–Z</SelectItem>
                                <SelectItem value="name-za">Name Z–A</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Action list */}
                    {filtered.length > 0 ? (
                        <ScrollArea className="max-h-52">
                            <div className="space-y-1">
                                {filtered.map((action) => (
                                    <div
                                        key={action.id}
                                        className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                                    >
                                        {/* Action ID - clickable */}
                                        <button
                                            onClick={() => onActionClick(action.id)}
                                            className={cn(
                                                'shrink-0 cursor-pointer font-mono text-xs hover:underline',
                                                colorClass,
                                            )}
                                        >
                                            {action.id}
                                        </button>

                                        {/* Revoked indicator */}
                                        {action.isRevoked && (
                                            <Undo2Icon
                                                className="text-muted-foreground size-3 shrink-0"
                                                aria-label="Revoked"
                                            />
                                        )}

                                        {/* Player name */}
                                        <span className="min-w-0 truncate">
                                            {action.playerName ? (
                                                action.playerLicense ? (
                                                    <button
                                                        onClick={() => onPlayerClick(action)}
                                                        className="text-accent-foreground flex cursor-pointer items-center gap-1 hover:underline"
                                                    >
                                                        {action.playerName}
                                                        <ExternalLinkIcon className="size-3 shrink-0 opacity-50" />
                                                    </button>
                                                ) : (
                                                    <span>{action.playerName}</span>
                                                )
                                            ) : (
                                                <span className="text-muted-foreground italic">unknown</span>
                                            )}
                                        </span>

                                        {/* Reason */}
                                        <span
                                            className="text-muted-foreground ml-auto max-w-40 shrink-0 truncate text-xs"
                                            title={action.reason}
                                        >
                                            {action.reason}
                                        </span>

                                        {/* Time */}
                                        <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                                            {tsToLocaleDateTimeString(action.timestamp, 'short', 'short')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="text-muted-foreground py-2 text-center text-xs">No matches found.</div>
                    )}
                </div>
            )}

            {expanded && actions.length === 0 && (
                <div className="text-muted-foreground border-t p-3 text-center text-xs">
                    No {label.toLowerCase()} recorded.
                </div>
            )}
        </div>
    );
}

export default function AdminStatsDialog({
    open,
    onOpenChange,
    adminName,
    stats: propStats,
    actionsRank,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    adminName: string;
    stats?: AdminStatsEntry;
    actionsRank?: number;
}) {
    const [state, dispatch] = useReducer(reduceAdminStatsDialogState, {
        fetchedStats: undefined,
        allActions: null,
        actionsLoading: false,
    });
    const { fetchedStats, allActions, actionsLoading } = state;
    const stats = propStats ?? fetchedStats;
    const safeStats: AdminStatsEntry = stats ?? {
        totalBans: 0,
        totalWarns: 0,
        totalKicks: 0,
        revokedActions: 0,
        totalActions: 0,
        totalTicketsResolved: 0,
    };
    const bansPercent =
        safeStats.totalActions > 0 ? Math.round((safeStats.totalBans / safeStats.totalActions) * 100) : 0;
    const warnsPercent =
        safeStats.totalActions > 0 ? Math.round((safeStats.totalWarns / safeStats.totalActions) * 100) : 0;
    const kicksPercent =
        safeStats.totalActions > 0 ? Math.round((safeStats.totalKicks / safeStats.totalActions) * 100) : 0;
    const revokedPercent =
        safeStats.totalActions > 0 ? Math.round((safeStats.revokedActions / safeStats.totalActions) * 100) : 0;

    const openPlayerModal = useOpenPlayerModal();
    const openActionModal = useOpenActionModal();
    const actionsApi = useBackendApi<ApiGetAdminActionsResp>({
        method: 'GET',
        path: '/adminManager/adminActions',
    });
    const statsApi = useBackendApi<ApiGetAdminStatsResp>({
        method: 'GET',
        path: '/adminManager/stats',
    });

    useEffect(() => {
        if (!open) {
            dispatch({ allActions: null, fetchedStats: undefined, actionsLoading: false });
            return;
        }
        dispatch({ actionsLoading: true });
        actionsApi({
            queryParams: { admin: adminName },
            success: (data) => {
                if ('actions' in data) {
                    dispatch({ allActions: data.actions });
                }
            },
            finally: () => dispatch({ actionsLoading: false }),
        });
        if (!propStats) {
            statsApi({
                success: (data) => {
                    if ('stats' in data) {
                        dispatch({ fetchedStats: data.stats[adminName] });
                    }
                },
            });
        }
    }, [open, adminName, propStats]);

    const bans = useMemo(() => allActions?.filter((a) => a.type === 'ban') ?? [], [allActions]);
    const warns = useMemo(() => allActions?.filter((a) => a.type === 'warn') ?? [], [allActions]);
    const kicks = useMemo(() => allActions?.filter((a) => a.type === 'kick') ?? [], [allActions]);

    const handlePlayerClick = (action: AdminRecentAction) => {
        if (action.playerLicense) {
            onOpenChange(false);
            openPlayerModal({ license: action.playerLicense });
        }
    };

    const handleActionClick = (actionId: string) => {
        onOpenChange(false);
        openActionModal(actionId);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BarChart3Icon className="size-5" />
                        {adminName}: Stats
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Overview */}
                    <div className={cn('grid gap-3', actionsRank ? 'grid-cols-6' : 'grid-cols-5')}>
                        {actionsRank && (
                            <div className="bg-muted/50 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold">#{actionsRank}</div>
                                <div className="text-muted-foreground text-xs">Rank</div>
                            </div>
                        )}
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold">{safeStats.totalActions}</div>
                            <div className="text-muted-foreground text-xs">Total</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <div className="text-destructive text-2xl font-bold">{safeStats.totalBans}</div>
                            <div className="text-muted-foreground text-xs">Bans</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <div className="text-muted-foreground text-2xl font-bold">{safeStats.totalKicks}</div>
                            <div className="text-muted-foreground text-xs">Kicks</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <div className="text-warning text-2xl font-bold">{safeStats.totalWarns}</div>
                            <div className="text-muted-foreground text-xs">Warns</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                            <div className="text-info text-2xl font-bold">{safeStats.totalTicketsResolved}</div>
                            <div className="text-muted-foreground text-xs">Tickets</div>
                        </div>
                    </div>

                    {/* Ratio bar */}
                    <div className="space-y-1.5">
                        <div className="bg-muted flex h-2 gap-1 overflow-hidden rounded-full">
                            <div
                                className="bg-destructive rounded-full transition-all"
                                style={{ width: `${bansPercent}%` }}
                            />
                            <div
                                className="bg-muted-foreground rounded-full transition-all"
                                style={{ width: `${kicksPercent}%` }}
                            />
                            <div
                                className="bg-warning rounded-full transition-all"
                                style={{ width: `${warnsPercent}%` }}
                            />
                        </div>
                        <div className="text-muted-foreground flex items-center justify-center gap-4 text-xs">
                            <span className="inline-flex items-center gap-1">
                                <span className="bg-destructive size-2 rounded-full" />
                                Bans {bansPercent}%
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <span className="bg-muted-foreground size-2 rounded-full" />
                                Kicks {kicksPercent}%
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <span className="bg-warning size-2 rounded-full" />
                                Warns {warnsPercent}%
                            </span>
                        </div>
                    </div>

                    {/* Revocation */}
                    {safeStats.revokedActions > 0 && (
                        <div className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2">
                            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                                <RotateCcwIcon className="size-3.5" />
                                Revoked
                            </span>
                            <span className="text-sm font-medium">
                                {safeStats.revokedActions} of {safeStats.totalActions} ({revokedPercent}%)
                            </span>
                        </div>
                    )}

                    {/* Action sections */}
                    {actionsLoading ? (
                        <div className="flex justify-center py-4">
                            <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
                        </div>
                    ) : allActions ? (
                        <div className="space-y-2">
                            <ActionTypeSection
                                label="Bans"
                                icon={<GavelIcon className="text-destructive size-4" />}
                                colorClass="text-destructive"
                                actions={bans}
                                onPlayerClick={handlePlayerClick}
                                onActionClick={handleActionClick}
                            />
                            <ActionTypeSection
                                label="Kicks"
                                icon={<LogOutIcon className="text-muted-foreground size-4" />}
                                colorClass="text-muted-foreground"
                                actions={kicks}
                                onPlayerClick={handlePlayerClick}
                                onActionClick={handleActionClick}
                            />
                            <ActionTypeSection
                                label="Warns"
                                icon={<AlertTriangleIcon className="text-warning size-4" />}
                                colorClass="text-warning"
                                actions={warns}
                                onPlayerClick={handlePlayerClick}
                                onActionClick={handleActionClick}
                            />
                        </div>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}
