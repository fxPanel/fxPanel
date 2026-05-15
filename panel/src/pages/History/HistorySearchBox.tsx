import { throttle } from 'throttle-debounce';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronsUpDownIcon, XIcon, ChevronDownIcon, ExternalLinkIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/auth';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HistoryTableSearchType } from '@shared/historyApiTypes';

/**
 * Helpers
 */
export const availableSearchTypes = [
    {
        value: 'actionId',
        label: 'Action ID',
        placeholder: 'XXXX-XXXX',
        description: 'Search actions by their ID.',
    },
    {
        value: 'reason',
        label: 'Reason',
        placeholder: 'Enter part of the reason to search for',
        description: 'Search actions by their reason contents.',
    },
    {
        value: 'identifiers',
        label: 'Player IDs',
        placeholder: 'License, Discord, Steam, etc.',
        description: 'Search actions by their player IDs separated by a comma.',
    },
] as const;

export const SEARCH_ANY_STRING = '!any';

//FIXME: this doesn't require exporting, but HMR doesn't work without it
// eslint-disable-next-line react-refresh/only-export-components
const throttleFunc = throttle(
    1250,
    (func: any) => {
        func();
    },
    { noLeading: true },
);

/**
 * Component
 */
export type HistorySearchBoxReturnStateType = {
    search: HistoryTableSearchType;
    filterByType?: string;
    filterByAdmin?: string;
};

type HistorySearchBoxProps = {
    doSearch: (
        search: HistoryTableSearchType,
        filterByType: string | undefined,
        filterByAdmin: string | undefined,
    ) => void;
    initialState: HistorySearchBoxReturnStateType;
    adminStats: {
        name: string;
        actions: number;
    }[];
};

export function HistorySearchBox({ doSearch, initialState, adminStats }: HistorySearchBoxProps) {
    const { authData } = useAuth();
    const inputRef = useRef<HTMLInputElement>(null);
    const initialStateRef = useRef(initialState);
    const [currSearchType, setCurrSearchType] = useState<string>(initialStateRef.current.search.type);
    const [hasSearchText, setHasSearchText] = useState(!!initialStateRef.current.search.value);
    const [typeFilter, setTypeFilter] = useState(initialStateRef.current.filterByType);
    const [adminNameFilter, setAdminNameFilter] = useState(initialStateRef.current.filterByAdmin);
    const authName = authData && typeof authData === 'object' ? authData.name : undefined;

    const updateSearch = useCallback(() => {
        if (!inputRef.current) return;
        const searchValue = inputRef.current.value.trim();
        const effectiveTypeFilter = typeFilter !== SEARCH_ANY_STRING ? typeFilter : undefined;
        const effectiveAdminNameFilter = adminNameFilter !== SEARCH_ANY_STRING ? adminNameFilter : undefined;
        doSearch({ value: searchValue, type: currSearchType }, effectiveTypeFilter, effectiveAdminNameFilter);
    }, [doSearch, currSearchType, typeFilter, adminNameFilter]);

    //Call onSearch when params change
    useEffect(() => {
        updateSearch();
    }, [updateSearch]);

    //Input handlers
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            throttleFunc.cancel({ upcomingOnly: true });
            updateSearch();
        } else if (e.key === 'Escape') {
            inputRef.current!.value = '';
            throttleFunc(updateSearch);
            setHasSearchText(false);
        } else {
            throttleFunc(updateSearch);
            setHasSearchText(true);
        }
    };

    const clearSearchBtn = () => {
        inputRef.current!.value = '';
        throttleFunc.cancel({ upcomingOnly: true });
        updateSearch();
        setHasSearchText(false);
    };

    //It's render time! 🎉
    const filteredAdmins = useMemo(() => {
        return adminStats.filter((admin) => admin.name !== authName);
    }, [adminStats, authName]);
    const selfActionCount = useMemo(() => {
        return adminStats.find((admin) => admin.name === authName)?.actions || 0;
    }, [adminStats, authName]);

    const selectedSearchType = availableSearchTypes.find((type) => type.value === currSearchType);
    if (!selectedSearchType) throw new Error(`Invalid search type: ${currSearchType}`);
    if (!authData) throw new Error(`authData is not available`);
    return (
        <div className="border-border/60 bg-card text-card-foreground mb-4 rounded-xl border p-4 shadow-sm">
            <div className="flex flex-wrap-reverse gap-2">
                <div className="relative min-w-44 grow">
                    <Input
                        type="text"
                        autoCapitalize="off"
                        autoCorrect="off"
                        ref={inputRef}
                        placeholder={selectedSearchType.placeholder}
                        defaultValue={initialStateRef.current.search.value}
                        onKeyDown={handleInputKeyDown}
                    />
                    {hasSearchText && (
                        <button
                            className="ring-offset-background focus-visible:ring-ring absolute inset-y-0 right-2 rounded-lg text-zinc-400 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
                            onClick={clearSearchBtn}
                        >
                            <XIcon />
                        </button>
                    )}
                </div>

                <div className="flex grow flex-wrap content-start gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="xs:w-48 grow justify-between md:grow-0"
                            >
                                Search by {selectedSearchType.label}
                                <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48">
                            <DropdownMenuLabel>Search Type</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup value={currSearchType} onValueChange={setCurrSearchType}>
                                {availableSearchTypes.map((searchType) => (
                                    <DropdownMenuRadioItem
                                        key={searchType.value}
                                        value={searchType.value}
                                        className="cursor-pointer"
                                    >
                                        {searchType.label}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Select defaultValue={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-36 grow md:grow-0">
                            <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent className="px-0">
                            <SelectItem value={SEARCH_ANY_STRING} className="cursor-pointer">
                                Any type
                            </SelectItem>
                            <SelectItem value={'ban'} className="cursor-pointer">
                                Bans
                            </SelectItem>
                            <SelectItem value={'warn'} className="cursor-pointer">
                                Warns
                            </SelectItem>
                            <SelectItem value={'kick'} className="cursor-pointer">
                                Kicks
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <Select defaultValue={adminNameFilter} onValueChange={setAdminNameFilter}>
                        <SelectTrigger className="w-36 grow md:grow-0">
                            <SelectValue placeholder="Filter by admin" />
                        </SelectTrigger>
                        <SelectContent className="px-0">
                            <SelectItem value={SEARCH_ANY_STRING} className="cursor-pointer">
                                By any admin
                            </SelectItem>
                            <SelectItem value={authData.name} className="cursor-pointer">
                                {authData.name} <span className="opacity-50">({selfActionCount})</span>
                            </SelectItem>

                            <SelectSeparator />
                            {filteredAdmins.map((admin) => (
                                <SelectItem className="cursor-pointer" key={admin.name} value={admin.name}>
                                    {admin.name} <span className="opacity-50">({admin.actions})</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex grow justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="grow md:grow-0">
                                    More
                                    <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem className="h-10 py-2 pr-2 pl-1" asChild>
                                    <Link href="/settings#danger-zone" className="cursor-pointer">
                                        <ExternalLinkIcon className="mr-1 inline h-4" />
                                        Bulk Remove
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="h-10 py-2 pr-2 pl-1" asChild>
                                    <Link href="/settings/ban-templates" className="cursor-pointer">
                                        <ExternalLinkIcon className="mr-1 inline h-4" />
                                        Ban Templates
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
            <div className="text-muted-foreground mt-1 px-1 text-xs">{selectedSearchType.description}</div>
        </div>
    );
}
