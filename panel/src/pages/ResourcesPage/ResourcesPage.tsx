import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';
import {
    FolderIcon,
    FolderOpenIcon,
    SearchIcon,
    RefreshCwIcon,
    PlayIcon,
    SquareIcon,
    RotateCwIcon,
    PackageIcon,
    Loader2Icon,
    AlertCircleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    CpuIcon,
    MemoryStickIcon,
    TimerIcon,
} from 'lucide-react';
import { useBackendApi, ApiTimeout } from '@/hooks/fetch';
import { PageHeader } from '@/components/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminPerms } from '@/hooks/auth';
import {
    ResourcesListResp,
    ResourceItemData,
    ResourceGroup,
    ResourceStatusEvent,
    ResourcesWsEventType,
} from '@shared/resourcesApiTypes';
import { ApiToastResp } from '@shared/genericApiTypes';
import { getSocket, joinSocketRoom, leaveSocketRoom } from '@/lib/utils';

type StatusFilter = 'all' | 'started' | 'stopped';

type ResourcesViewState = {
    searchQuery: string;
    statusFilter: StatusFilter;
    expandedFolders: Set<string>;
    selectedFolder: string | null;
};

// Merge WebSocket updates into the SWR data
function mergeWsUpdate(
    data: Exclude<ResourcesListResp, { error: string }> | undefined,
    wsData: Map<string, ResourceStatusEvent>,
): Exclude<ResourcesListResp, { error: string }> | undefined {
    if (!data) return data;
    let startedCount = 0;
    let stoppedCount = 0;
    const groups = data.groups.map((group) => ({
        ...group,
        resources: group.resources.map((res) => {
            const ws = wsData.get(res.name);
            const updated = ws ? { ...res, status: ws.status, perf: ws.perf } : res;
            if (updated.status === 'started') startedCount++;
            else stoppedCount++;
            return updated;
        }),
    }));
    return { groups, totalResources: startedCount + stoppedCount, startedCount, stoppedCount };
}

export default function ResourcesPage() {
    const [viewState, setViewState] = useState<ResourcesViewState>({
        searchQuery: '',
        statusFilter: 'all',
        expandedFolders: new Set(),
        selectedFolder: null,
    });
    const wsDataRef = useRef<Map<string, ResourceStatusEvent>>(new Map());
    const [wsRevision, setWsRevision] = useState(0);
    const { searchQuery, statusFilter, expandedFolders, selectedFolder } = viewState;
    const { hasPerm } = useAdminPerms();
    const canControl = hasPerm('commands.resources');

    const setViewField = <K extends keyof ResourcesViewState>(key: K, value: ResourcesViewState[K]) => {
        setViewState((prev) => ({ ...prev, [key]: value }));
    };

    const listApi = useBackendApi<ResourcesListResp>({
        method: 'GET',
        path: '/resources/list',
    });

    const commandApi = useBackendApi<ApiToastResp>({
        method: 'POST',
        path: '/fxserver/commands',
    });

    const swr = useSWR(
        '/resources/list',
        async () => {
            const data = await listApi({ timeout: ApiTimeout.LONG });
            if (!data) throw new Error('empty response');
            if ('error' in data) throw new Error(data.error);
            return data;
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 5_000,
        },
    );

    // WebSocket integration for real-time updates
    useEffect(() => {
        const socket = getSocket();
        const resourcesHandler = (data: ResourcesWsEventType) => {
            if (data.type === 'full' && data.resources) {
                const map = new Map<string, ResourceStatusEvent>();
                for (const res of data.resources) {
                    map.set(res.name, res);
                }
                wsDataRef.current = map;
            } else if (data.type === 'update' && data.updates) {
                for (const update of data.updates) {
                    wsDataRef.current.set(update.name, update);
                }
            }
            setWsRevision((r) => r + 1);
        };
        socket.on('resources', resourcesHandler);
        joinSocketRoom('resources');

        return () => {
            socket.off('resources', resourcesHandler);
            leaveSocketRoom('resources');
        };
    }, []);

    // Merge REST data with WebSocket real-time updates
    const liveData = useMemo(() => {
        void wsRevision; // dependency trigger
        return mergeWsUpdate(swr.data, wsDataRef.current);
    }, [swr.data, wsRevision]);

    const handleResourceAction = useCallback(
        async (action: string, resourceName: string) => {
            try {
                await commandApi({
                    data: { action, parameter: resourceName },
                });
                setTimeout(() => swr.mutate(), 1500);
            } catch {
                // Error handled by the hook's toast
            }
        },
        [commandApi, swr],
    );

    const handleRefresh = useCallback(async () => {
        try {
            await commandApi({
                data: { action: 'refresh_res', parameter: '' },
            });
            setTimeout(() => swr.mutate(), 1500);
        } catch {
            // Error handled by the hook's toast
        }
    }, [commandApi, swr]);

    const toggleFolder = useCallback((folderPath: string) => {
        setViewState((prev) => {
            const nextExpandedFolders = new Set(prev.expandedFolders);
            if (nextExpandedFolders.has(folderPath)) {
                nextExpandedFolders.delete(folderPath);
            } else {
                nextExpandedFolders.add(folderPath);
            }
            return { ...prev, expandedFolders: nextExpandedFolders };
        });
    }, []);

    // Filter groups based on search, status filter, and selected folder
    const filteredGroups = useMemo(() => {
        if (!liveData) return [];
        let groups = liveData.groups;

        if (selectedFolder) {
            groups = groups.filter((g) => g.subPath === selectedFolder);
        }

        return groups.flatMap((group) => {
                let resources = group.resources;

                if (statusFilter !== 'all') {
                    resources = resources.filter((r) => r.status === statusFilter);
                }

                if (searchQuery.trim()) {
                    const query = searchQuery.toLowerCase();
                    resources = resources.filter(
                        (r) =>
                            r.name.toLowerCase().includes(query) ||
                            r.author.toLowerCase().includes(query) ||
                            r.description.toLowerCase().includes(query),
                    );
                }

                return resources.length > 0 ? [{ ...group, resources }] : [];
            });
    }, [liveData, searchQuery, statusFilter, selectedFolder]);

    // Expand all folders that have matching resources when searching
    const effectiveFolders = useMemo(() => {
        if (searchQuery.trim()) {
            return new Set(filteredGroups.map((g) => g.subPath));
        }
        return expandedFolders;
    }, [searchQuery, filteredGroups, expandedFolders]);

    return (
        <div className="h-contentvh flex w-full flex-col">
            <PageHeader title="Resources" icon={<PackageIcon />} />
            <div className="flex w-full flex-1 overflow-hidden">
                {/* Sidebar - Folder tree */}
                <aside className="bg-card hidden w-64 flex-shrink-0 flex-col border-r md:flex">
                    <div className="border-b p-3">
                        <h3 className="text-sm font-semibold">Folders</h3>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-2">
                            <button
                                onClick={() => setViewField('selectedFolder', null)}
                                className={`text-muted-foreground hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                                    selectedFolder === null ? 'bg-accent text-accent-foreground font-medium' : ''
                                }`}
                            >
                                <FolderOpenIcon className="size-4" />
                                All Folders
                                {liveData && (
                                    <span className="text-muted-foreground ml-auto text-xs">
                                        {liveData.totalResources}
                                    </span>
                                )}
                            </button>
                            {liveData?.groups.map((group) => (
                                <button
                                    key={group.subPath}
                                    onClick={() =>
                                        setViewField(
                                            'selectedFolder',
                                            selectedFolder === group.subPath ? null : group.subPath,
                                        )
                                    }
                                    className={`text-muted-foreground hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                                        selectedFolder === group.subPath
                                            ? 'bg-accent text-accent-foreground font-medium'
                                            : ''
                                    }`}
                                >
                                    <FolderIcon className="size-4" />
                                    <span className="truncate">{group.subPath}</span>
                                    <span className="text-muted-foreground ml-auto text-xs">
                                        {group.resources.length}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </aside>

                {/* Main content */}
                <div className="flex min-w-0 flex-1 flex-col">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 border-b p-3">
                        <div className="relative min-w-[200px] flex-1">
                            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                placeholder="Search resources..."
                                value={searchQuery}
                                onChange={(e) => setViewField('searchQuery', e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <FilterButtons
                                statusFilter={statusFilter}
                                onFilterChange={(value) => setViewField('statusFilter', value)}
                                data={liveData}
                            />
                            {canControl && (
                                <Button variant="outline" size="sm" onClick={handleRefresh} title="Refresh resources">
                                    <RefreshCwIcon className="size-4" />
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => swr.mutate()}
                                disabled={swr.isLoading}
                                title="Reload list"
                            >
                                {swr.isLoading ? (
                                    <Loader2Icon className="size-4 animate-spin" />
                                ) : (
                                    <RotateCwIcon className="size-4" />
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Resource list */}
                    <ScrollArea className="flex-1">
                        {swr.isLoading ? (
                            <div className="flex items-center justify-center p-12">
                                <Loader2Icon className="text-muted-foreground size-8 animate-spin" />
                            </div>
                        ) : swr.error ? (
                            <div className="flex flex-col items-center justify-center gap-2 p-12">
                                <AlertCircleIcon className="text-destructive size-8" />
                                <p className="text-muted-foreground text-sm">{swr.error.message}</p>
                                <Button variant="outline" size="sm" onClick={() => swr.mutate()}>
                                    Retry
                                </Button>
                            </div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="text-muted-foreground flex items-center justify-center p-12 text-sm">
                                {searchQuery ? 'No resources match your search.' : 'No resources found.'}
                            </div>
                        ) : (
                            <div className="p-3">
                                {filteredGroups.map((group) => (
                                    <ResourceGroupSection
                                        key={group.subPath}
                                        group={group}
                                        expanded={effectiveFolders.has(group.subPath)}
                                        onToggle={() => toggleFolder(group.subPath)}
                                        canControl={canControl}
                                        onAction={handleResourceAction}
                                    />
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}

function FilterButtons({
    statusFilter,
    onFilterChange,
    data,
}: {
    statusFilter: StatusFilter;
    onFilterChange: (f: StatusFilter) => void;
    data?: { startedCount: number; stoppedCount: number; totalResources: number };
}) {
    return (
        <div className="flex rounded-md border">
            <button
                onClick={() => onFilterChange('all')}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === 'all'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50'
                }`}
            >
                All{data ? ` (${data.totalResources})` : ''}
            </button>
            <button
                onClick={() => onFilterChange('started')}
                className={`border-l px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === 'started'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50'
                }`}
            >
                Started{data ? ` (${data.startedCount})` : ''}
            </button>
            <button
                onClick={() => onFilterChange('stopped')}
                className={`border-l px-2.5 py-1 text-xs font-medium transition-colors ${
                    statusFilter === 'stopped'
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/50'
                }`}
            >
                Stopped{data ? ` (${data.stoppedCount})` : ''}
            </button>
        </div>
    );
}

function ResourceGroupSection({
    group,
    expanded,
    onToggle,
    canControl,
    onAction,
}: {
    group: ResourceGroup;
    expanded: boolean;
    onToggle: () => void;
    canControl: boolean;
    onAction: (action: string, name: string) => void;
}) {
    const startedCount = group.resources.filter((r) => r.status === 'started').length;

    return (
        <div className="mb-2">
            <button
                onClick={onToggle}
                className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
            >
                {expanded ? (
                    <ChevronDownIcon className="text-muted-foreground size-4" />
                ) : (
                    <ChevronRightIcon className="text-muted-foreground size-4" />
                )}
                <FolderIcon className="size-4 text-amber-500" />
                <span className="text-sm font-medium">{group.subPath}</span>
                <span className="text-muted-foreground ml-1 text-xs">
                    {startedCount}/{group.resources.length}
                </span>
            </button>
            {expanded && (
                <div className="mt-1 ml-6 space-y-1">
                    {group.resources.map((resource) => (
                        <ResourceRow
                            key={resource.name}
                            resource={resource}
                            canControl={canControl}
                            onAction={onAction}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function PerfDisplay({ resource }: { resource: ResourceItemData }) {
    if (!resource.perf) return null;
    const { cpu, memory, tickTime } = resource.perf;

    return (
        <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-3 text-xs">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span
                            className={`flex items-center gap-1 ${cpu > 5 ? 'text-warning' : 'text-muted-foreground'}`}
                        >
                            <CpuIcon className="size-3" />
                            {cpu.toFixed(1)}ms
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>CPU time per frame</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span
                            className={`flex items-center gap-1 ${memory > 128000 ? 'text-warning' : 'text-muted-foreground'}`}
                        >
                            <MemoryStickIcon className="size-3" />
                            {memory > 1024 ? `${(memory / 1024).toFixed(1)}MB` : `${memory}KB`}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>Memory usage</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span
                            className={`flex items-center gap-1 ${tickTime > 5 ? 'text-warning' : 'text-muted-foreground'}`}
                        >
                            <TimerIcon className="size-3" />
                            {tickTime.toFixed(2)}ms
                        </span>
                    </TooltipTrigger>
                    <TooltipContent>Average tick time</TooltipContent>
                </Tooltip>
            </div>
        </TooltipProvider>
    );
}

function ResourceRow({
    resource,
    canControl,
    onAction,
}: {
    resource: ResourceItemData;
    canControl: boolean;
    onAction: (action: string, name: string) => void;
}) {
    const isStarted = resource.status === 'started';
    const isStarting = resource.status === 'starting';

    return (
        <div className="hover:bg-accent/50 flex items-center gap-3 rounded-md px-3 py-2 transition-colors">
            {/* Status indicator */}
            <div
                className={`size-2 flex-shrink-0 rounded-full ${
                    isStarted ? 'bg-green-500' : isStarting ? 'animate-pulse bg-yellow-500' : 'bg-red-500'
                }`}
            />

            {/* Name and metadata */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{resource.name}</span>
                    {resource.version && <span className="text-muted-foreground text-xs">{resource.version}</span>}
                </div>
                {(resource.description || resource.author) && (
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        {resource.description && <span className="truncate">{resource.description}</span>}
                        {resource.author && <span className="flex-shrink-0">by {resource.author}</span>}
                    </div>
                )}
            </div>

            {/* Performance stats */}
            {isStarted && <PerfDisplay resource={resource} />}

            {/* Status badge */}
            <Badge
                variant={isStarted ? 'default' : isStarting ? 'secondary' : 'destructive'}
                className="flex-shrink-0 text-xs"
            >
                {resource.status}
            </Badge>

            {/* Actions */}
            {canControl && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="size-7 p-0">
                            <ChevronDownIcon className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onAction('restart_res', resource.name)}>
                            <RotateCwIcon className="mr-2 size-4" />
                            Restart
                        </DropdownMenuItem>
                        {isStarted ? (
                            <DropdownMenuItem onClick={() => onAction('stop_res', resource.name)}>
                                <SquareIcon className="mr-2 size-4" />
                                Stop
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem onClick={() => onAction('start_res', resource.name)}>
                                <PlayIcon className="mr-2 size-4" />
                                Start
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
