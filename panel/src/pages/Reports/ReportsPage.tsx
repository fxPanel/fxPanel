import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useBackendApi } from '@/hooks/fetch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/page-header';
import {
    ArchiveIcon,
    BarChart2Icon,
    FlagIcon,
    Loader2Icon,
    SearchIcon,
    UserCheckIcon,
} from 'lucide-react';
import type { ApiGetTicketListResp, TicketListItem, TicketStatus, TicketPriority } from '@shared/ticketApiTypes';
import TicketDetailModal from './TicketDetailModal';
import { navigate } from 'wouter/use-browser-location';

const statusLabels: Record<TicketStatus, string> = {
    open: 'Open',
    inReview: 'In Review',
    resolved: 'Resolved',
    closed: 'Closed',
};

const statusVariants: Record<TicketStatus, 'default' | 'secondary' | 'outline-solid' | 'destructive'> = {
    open: 'destructive',
    inReview: 'default',
    resolved: 'secondary',
    closed: 'outline-solid',
};

const priorityColors: Record<TicketPriority, string> = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    critical: 'text-red-500',
};

type ReportsViewState = {
    searchQuery: string;
    categoryFilter: string;
    statusFilter: string;
    priorityFilter: string;
    showArchived: boolean;
    selectedTicketId: string | null;
};

export default function ReportsPage() {
    const [viewState, setViewState] = useState<ReportsViewState>({
        searchQuery: '',
        categoryFilter: 'all',
        statusFilter: 'all',
        priorityFilter: 'all',
        showArchived: false,
        selectedTicketId: null,
    });
    const { searchQuery, categoryFilter, statusFilter, priorityFilter, showArchived, selectedTicketId } = viewState;

    const setViewField = <K extends keyof ReportsViewState>(key: K, value: ReportsViewState[K]) => {
        setViewState((prev) => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        const pageUrl = new URL(window.location.toString());
        const ticketId = pageUrl.searchParams.get('ticket');
        if (!ticketId?.length) return;

        setViewField('selectedTicketId', ticketId);

        // Consume deep-link param after opening so refresh/back doesn't keep reopening.
        pageUrl.searchParams.delete('ticket');
        window.history.replaceState({}, '', pageUrl);
    }, []);

    const listApi = useBackendApi<ApiGetTicketListResp>({
        method: 'GET',
        path: '/reports/list',
        throwGenericErrors: true,
    });

    const ticketsSwr = useSWR(
        '/reports/list',
        async () => {
            const data = await listApi({});
            if (!data) throw new Error('Failed to load tickets: no data received');
            if ('error' in data) throw new Error(`Failed to load tickets: ${data.error}`);
            return data.tickets;
        },
        { dedupingInterval: 5_000 },
    );

    const tickets = ticketsSwr.data ?? [];

    // Gather unique categories from loaded tickets for the filter dropdown
    const knownCategories = Array.from(new Set(tickets.map((t) => t.category)));

    const baseFilteredTickets = tickets.filter((t) => {
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                t.id.toLowerCase().includes(q) ||
                t.reporterName.toLowerCase().includes(q) ||
                t.descriptionPreview.toLowerCase().includes(q) ||
                t.targetNames.some((n) => n.toLowerCase().includes(q)) ||
                (t.claimedBy?.toLowerCase().includes(q) ?? false)
            );
        }
        return true;
    });

    const archivedTickets = baseFilteredTickets.filter((ticket) => ticket.status === 'closed');
    const showArchivedSection = showArchived;
    const activeTickets = showArchivedSection
        ? []
        : baseFilteredTickets.filter((ticket) => {
              if (ticket.status === 'closed') return false;
              if (statusFilter === 'all') return true;
              return ticket.status === statusFilter;
          });
    const hasVisibleTickets = showArchivedSection ? archivedTickets.length > 0 : activeTickets.length > 0;

    const formatDate = (ts: number) => {
        const d = new Date(ts * 1000);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const openCount = tickets.filter((t) => t.status === 'open').length;
    const inReviewCount = tickets.filter((t) => t.status === 'inReview').length;

    return (
        <div className="h-contentvh flex w-full flex-col">
            <PageHeader icon={<FlagIcon className="size-5" />} title="Reports">
                <div className="flex items-center gap-2">
                    {openCount > 0 && <Badge variant="destructive">{openCount} open</Badge>}
                    {inReviewCount > 0 && <Badge variant="default">{inReviewCount} in review</Badge>}
                    <Button variant="outline-solid" size="sm" onClick={() => navigate('/reports/analytics')}>
                        <BarChart2Icon className="mr-1 size-4" /> Analytics
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => ticketsSwr.mutate()}
                        disabled={ticketsSwr.isLoading}
                    >
                        {ticketsSwr.isLoading ? <Loader2Icon className="size-4 animate-spin" /> : 'Refresh'}
                    </Button>
                </div>
            </PageHeader>

            <div className="bg-card border-border/60 flex w-full flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
                {/* Filters */}
                <div className="border-border/40 flex shrink-0 flex-wrap gap-2 border-b p-3">
                    <div className="relative min-w-[180px] flex-1">
                        <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                        <Input
                            placeholder="Search tickets..."
                            value={searchQuery}
                            onChange={(e) => setViewField('searchQuery', e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={(value) => setViewField('statusFilter', value)}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="inReview">In Review</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                    </Select>
                    {knownCategories.length > 0 && (
                        <Select value={categoryFilter} onValueChange={(value) => setViewField('categoryFilter', value)}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {knownCategories.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Select value={priorityFilter} onValueChange={(value) => setViewField('priorityFilter', value)}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Priorities</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        type="button"
                        variant={showArchivedSection ? 'outline-solid' : 'outline'}
                        onClick={() => setViewState((prev) => ({ ...prev, showArchived: !prev.showArchived }))}
                        className="shrink-0"
                    >
                        <ArchiveIcon className="mr-2 size-4" />
                        Archived
                        <Badge variant={showArchivedSection ? 'secondary' : 'outline-solid'} className="ml-2">
                            {archivedTickets.length}
                        </Badge>
                    </Button>
                </div>

                {/* Ticket list */}
                <div className="flex-1 overflow-auto">
                    {ticketsSwr.isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
                        </div>
                    ) : ticketsSwr.error ? (
                        <p className="text-destructive py-8 text-center">Reports route not available.</p>
                    ) : !hasVisibleTickets ? (
                        <p className="text-muted-foreground py-8 text-center">
                            {tickets.length === 0 ? 'No tickets found.' : 'No tickets match your filters.'}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-3 p-3">
                            {activeTickets.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    {activeTickets.map((ticket) => (
                                        <TicketRow
                                            key={ticket.id}
                                            ticket={ticket}
                                            formatDate={formatDate}
                                            onClick={() => setViewField('selectedTicketId', ticket.id)}
                                        />
                                    ))}
                                </div>
                            )}

                            {showArchivedSection && archivedTickets.length > 0 && (
                                <div className="border-border/40 border-t pt-3">
                                    <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
                                        <ArchiveIcon className="size-4" />
                                        Archived Tickets
                                        <Badge variant="outline-solid" className="ml-1">
                                            {archivedTickets.length}
                                        </Badge>
                                    </div>

                                    <div className="mt-2 flex flex-col gap-2">
                                        {archivedTickets.map((ticket) => (
                                            <TicketRow
                                                key={ticket.id}
                                                ticket={ticket}
                                                formatDate={formatDate}
                                                onClick={() => setViewField('selectedTicketId', ticket.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail modal */}
            {selectedTicketId && (
                <TicketDetailModal
                    ticketId={selectedTicketId}
                    open
                    onOpenChange={(open) => {
                        if (!open) {
                            setViewField('selectedTicketId', null);
                            ticketsSwr.mutate();
                        }
                    }}
                />
            )}
        </div>
    );
}

function TicketRow({
    ticket,
    formatDate,
    onClick,
}: {
    ticket: TicketListItem;
    formatDate: (ts: number) => string;
    onClick: () => void;
}) {
    return (
        <button
            className="group bg-secondary/20 hover:bg-secondary/40 border-border/60 hover:border-border w-full cursor-pointer rounded-xl border p-4 text-left shadow-sm transition-all"
            onClick={onClick}
        >
            <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold tracking-wide">{ticket.id}</span>
                    <Badge variant={statusVariants[ticket.status]}>{statusLabels[ticket.status]}</Badge>
                    <span className="text-muted-foreground text-xs">{ticket.category}</span>
                    {ticket.priority && (
                        <span className={`text-xs font-semibold ${priorityColors[ticket.priority]}`}>
                            [{ticket.priority.toUpperCase()}]
                        </span>
                    )}
                    {ticket.claimedBy && (
                        <span className="text-muted-foreground flex items-center gap-1 text-xs">
                            <UserCheckIcon className="size-3" /> {ticket.claimedBy}
                        </span>
                    )}
                </div>
                <span className="text-muted-foreground text-xs">{formatDate(ticket.tsLastActivity)}</span>
            </div>
            <div className="flex items-center justify-between">
                <div className="text-sm">
                    <span className="text-muted-foreground">by </span>
                    <span className="font-medium">{ticket.reporterName}</span>
                    {ticket.targetNames.length > 0 && (
                        <>
                            <span className="text-muted-foreground"> → </span>
                            <span className="font-medium">{ticket.targetNames.join(', ')}</span>
                        </>
                    )}
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    {ticket.messageCount > 0 && (
                        <span>
                            {ticket.messageCount} msg{ticket.messageCount !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </div>
            <p className="text-muted-foreground mt-1.5 line-clamp-1 text-sm">{ticket.descriptionPreview}</p>
        </button>
    );
}
