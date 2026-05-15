import { throttle } from 'throttle-debounce';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronsUpDownIcon, FilterXIcon, XIcon, ChevronDownIcon, ExternalLinkIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlayersTableFiltersType, PlayersTableSearchType } from '@shared/playerApiTypes';
import { Link } from 'wouter';

/**
 * Helpers
 */
export const availableSearchTypes = [
    {
        value: 'playerName',
        label: 'Name',
        placeholder: 'Enter a player name',
        description: 'Search players by their last display name.',
    },
    {
        value: 'playerNotes',
        label: 'Notes',
        placeholder: 'Enter part of the note to search for',
        description: 'Search players by their profile notes contents.',
    },
    {
        value: 'playerIds',
        label: 'Player IDs',
        placeholder: 'License, Discord, Steam, etc.',
        description: 'Search players by their IDs separated by a comma.',
    },
] as const;

export const availableFilters = [
    { label: 'Is Admin', value: 'isAdmin' },
    { label: 'Is Online', value: 'isOnline' },
    { label: 'Is Banned', value: 'isBanned' },
    { label: 'Has Previous Ban', value: 'hasPreviousBan' },
    { label: 'Has Whitelisted ID', value: 'isWhitelisted' },
    { label: 'Has Profile Notes', value: 'hasNote' },
] as const;

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
export type PlayersSearchBoxReturnStateType = {
    search: PlayersTableSearchType;
    filters: PlayersTableFiltersType;
};

type PlayerSearchUiState = {
    isSearchTypeDropdownOpen: boolean;
    isFilterDropdownOpen: boolean;
    currSearchType: string;
    selectedFilters: string[];
    hasSearchText: boolean;
    rememberSearchType: boolean;
};

type PlayerSearchBoxProps = {
    doSearch: (search: PlayersTableSearchType, filters: PlayersTableFiltersType, rememberSearchType: boolean) => void;
    initialState: PlayersSearchBoxReturnStateType & { rememberSearchType: boolean };
};

export function PlayerSearchBox({ doSearch, initialState }: PlayerSearchBoxProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const initialStateRef = useRef(initialState);
    const [uiState, setUiState] = useState<PlayerSearchUiState>({
        isSearchTypeDropdownOpen: false,
        isFilterDropdownOpen: false,
        currSearchType: initialStateRef.current.search.type,
        selectedFilters: initialStateRef.current.filters,
        hasSearchText: !!initialStateRef.current.search.value,
        rememberSearchType: initialStateRef.current.rememberSearchType,
    });
    const {
        isSearchTypeDropdownOpen,
        isFilterDropdownOpen,
        currSearchType,
        selectedFilters,
        hasSearchText,
        rememberSearchType,
    } = uiState;

    const setUiField = <K extends keyof PlayerSearchUiState>(key: K, value: PlayerSearchUiState[K]) => {
        setUiState((prev) => ({ ...prev, [key]: value }));
    };

    const updateSearch = useCallback(() => {
        if (!inputRef.current) return;
        const searchValue = inputRef.current.value.trim();
        doSearch({ value: searchValue, type: currSearchType }, selectedFilters, rememberSearchType);
    }, [doSearch, currSearchType, selectedFilters, rememberSearchType]);

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
            setUiField('hasSearchText', false);
        } else {
            throttleFunc(updateSearch);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUiField('hasSearchText', e.currentTarget.value.length > 0);
    };

    const clearSearchBtn = () => {
        inputRef.current!.value = '';
        throttleFunc.cancel({ upcomingOnly: true });
        updateSearch();
        setUiField('hasSearchText', false);
    };

    const filterSelectChange = (filter: string, checked: boolean) => {
        setUiState((prev) => ({
            ...prev,
            selectedFilters: checked
                ? [...prev.selectedFilters, filter]
                : prev.selectedFilters.filter((currentFilter) => currentFilter !== filter),
        }));
    };

    //It's render time! 🎉
    const selectedSearchType = availableSearchTypes.find((type) => type.value === currSearchType);
    if (!selectedSearchType) throw new Error(`Invalid search type: ${currSearchType}`);
    const filterBtnMessage = selectedFilters.length
        ? `${selectedFilters.length} Filter${selectedFilters.length > 1 ? 's' : ''}`
        : 'No filters';
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
                        onChange={handleInputChange}
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
                    <DropdownMenu
                        open={isSearchTypeDropdownOpen}
                        onOpenChange={(open) => setUiField('isSearchTypeDropdownOpen', open)}
                    >
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                aria-expanded={isSearchTypeDropdownOpen}
                                className="xs:w-48 grow justify-between md:grow-0"
                            >
                                Search by {selectedSearchType.label}
                                <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48">
                            <DropdownMenuLabel>Search Type</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup
                                value={currSearchType}
                                onValueChange={(value) => setUiField('currSearchType', value)}
                            >
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
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                                checked={rememberSearchType}
                                className="cursor-pointer"
                                onCheckedChange={(checked) => setUiField('rememberSearchType', checked === true)}
                            >
                                Remember Option
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu
                        open={isFilterDropdownOpen}
                        onOpenChange={(open) => setUiField('isFilterDropdownOpen', open)}
                    >
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                aria-expanded={isFilterDropdownOpen}
                                className="xs:w-44 grow justify-between md:grow-0"
                            >
                                {filterBtnMessage}
                                <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-44">
                            <DropdownMenuLabel>Search Filters</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {availableFilters.map((filter) => (
                                <DropdownMenuCheckboxItem
                                    key={filter.value}
                                    checked={selectedFilters.includes(filter.value)}
                                    className="cursor-pointer"
                                    onCheckedChange={(checked) => {
                                        filterSelectChange(filter.value, checked);
                                    }}
                                >
                                    {filter.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => setUiField('selectedFilters', [])}
                            >
                                <FilterXIcon className="mr-2 size-4" />
                                Clear Filters
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

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
                                    <Link href="/ban-identifiers" className="cursor-pointer">
                                        <ExternalLinkIcon className="mr-1 inline h-4" />
                                        Ban Identifiers
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="h-10 py-2 pr-2 pl-1" asChild>
                                    <Link href="/settings#danger-zone" className="cursor-pointer">
                                        <ExternalLinkIcon className="mr-1 inline h-4" />
                                        Prune Players/HWIDs
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
