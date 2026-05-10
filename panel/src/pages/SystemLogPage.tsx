import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import { FitAddon } from '@xterm/addon-fit';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { useEventListener } from 'usehooks-ts';
import { useContentRefresh } from '@/hooks/pages';
import { debounce, throttle } from 'throttle-debounce';
import { ChevronsDownIcon, Loader2Icon, ScrollTextIcon } from 'lucide-react';

import './LiveConsole/xtermOverrides.css';
import '@xterm/xterm/css/xterm.css';
import { openExternalLink } from '@/lib/navigation';
import { handleHotkeyEvent } from '@/lib/hotkeyEventListener';
import terminalOptions from './LiveConsole/xtermOptions';
import ScrollDownAddon from './LiveConsole/ScrollDownAddon';
import LiveConsoleSearchBar from './LiveConsole/LiveConsoleSearchBar';
import { useBackendApi } from '@/hooks/fetch';
import { PageHeader } from '@/components/page-header';

//Helpers
const keyDebounceTime = 150; //ms
type SystemLogPageProps = {
    pageName: 'console';
};

type SystemLogPageState = {
    isLoading: boolean;
    loadError: string;
    showSearchBar: boolean;
};

type SystemLogPageAction =
    | { type: 'logsLoaded' }
    | { type: 'logsFailed'; loadError: string }
    | { type: 'setShowSearchBar'; showSearchBar: boolean };

function reduceSystemLogPageState(state: SystemLogPageState, action: SystemLogPageAction): SystemLogPageState {
    switch (action.type) {
        case 'logsLoaded':
            return {
                ...state,
                isLoading: false,
                loadError: '',
            };
        case 'logsFailed':
            return {
                ...state,
                isLoading: false,
                loadError: action.loadError,
            };
        case 'setShowSearchBar':
            return {
                ...state,
                showSearchBar: action.showSearchBar,
            };
        default:
            return state;
    }
}

//NOTE: most of this code is yoinked from the live console page
export default function SystemLogPage({ pageName }: SystemLogPageProps) {
    const [state, dispatch] = useReducer(reduceSystemLogPageState, {
        isLoading: true,
        loadError: '',
        showSearchBar: false,
    });
    const { isLoading, loadError, showSearchBar } = state;
    const refreshPage = useContentRefresh();
    const getLogsApi = useBackendApi<{ data: string }>({
        method: 'GET',
        path: `/logs/system/${pageName}`,
        throwGenericErrors: true,
    });

    /**
     * xterm stuff
     */
    const jumpBottomBtnRef = useRef<HTMLButtonElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const term = useMemo(() => new Terminal(terminalOptions), []);
    const fitAddon = useMemo(() => new FitAddon(), []);
    const searchAddon = useMemo(() => new SearchAddon(), []);
    const termLinkHandler = (event: MouseEvent, uri: string) => {
        openExternalLink(uri);
    };
    const webLinksAddon = useMemo(() => new WebLinksAddon(termLinkHandler), []);

    const sendSearchKeyEvent = throttle(
        keyDebounceTime,
        (action: string) => {
            window.postMessage({
                type: 'liveConsoleSearchHotkey',
                action,
            });
        },
        { noTrailing: true },
    );

    const refitTerminal = () => {
        if (!containerRef.current || !term.element || !fitAddon) {
            console.log('refitTerminal: no containerRef.current or term.element or fitAddon');
            return;
        }

        const proposed = fitAddon.proposeDimensions();
        if (proposed) {
            term.resize(proposed.cols, proposed.rows);
        } else {
            console.log('refitTerminal: no proposed dimensions');
        }
    };
    useEventListener('resize', debounce(100, refitTerminal));

    useEffect(() => {
        if (containerRef.current && jumpBottomBtnRef.current && !term.element) {
            console.log('xterm init');
            containerRef.current.innerHTML = ''; //due to HMR, the terminal element might still be there
            term.loadAddon(fitAddon);
            term.loadAddon(searchAddon);
            term.loadAddon(webLinksAddon);
            term.loadAddon(new WebglAddon());
            term.loadAddon(new ScrollDownAddon(jumpBottomBtnRef.current));
            term.open(containerRef.current);
            term.write('\x1b[?25l'); //hide cursor
            refitTerminal();

            const scrollPageUp = throttle(
                keyDebounceTime,
                () => {
                    term.scrollLines(Math.min(1, 2 - term.rows));
                },
                { noTrailing: true },
            );
            const scrollPageDown = throttle(
                keyDebounceTime,
                () => {
                    term.scrollLines(Math.max(1, term.rows - 2));
                },
                { noTrailing: true },
            );
            const scrollTop = throttle(
                keyDebounceTime,
                () => {
                    term.scrollToTop();
                },
                { noTrailing: true },
            );
            const scrollBottom = throttle(
                keyDebounceTime,
                () => {
                    term.scrollToBottom();
                },
                { noTrailing: true },
            );

            term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
                // Some are handled by the live console element
                if (e.code === 'F5') {
                    return false;
                } else if (e.code === 'Escape') {
                    return false;
                } else if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
                    return false;
                } else if (e.code === 'F3') {
                    return false;
                } else if (e.code === 'KeyC' && (e.ctrlKey || e.metaKey)) {
                    document.execCommand('copy');
                    term.clearSelection();
                    return false;
                } else if (e.code === 'PageUp') {
                    scrollPageUp();
                    return false;
                } else if (e.code === 'PageDown') {
                    scrollPageDown();
                    return false;
                } else if (e.code === 'Home') {
                    scrollTop();
                    return false;
                } else if (e.code === 'End') {
                    scrollBottom();
                    return false;
                } else if (handleHotkeyEvent(e)) {
                    return false;
                }
                return true;
            });

            //fetch logs
            getLogsApi({
                success: (resp, toastId) => {
                    dispatch({ type: 'logsLoaded' });
                    writeToTerminal(resp.data);
                    term.writeln('');
                    term.writeln('\u001b[33m[END OF LOG - REFRESH THE PAGE TO LOAD MORE]\u001b');
                },
                error: (message, toastId) => {
                    dispatch({ type: 'logsFailed', loadError: message });
                },
            });
        }
    }, [term]);

    //Hotkeys
    useEventListener('keydown', (e: KeyboardEvent) => {
        if (e.code === 'F5') {
            if (isLoading) {
                refreshPage();
                e.preventDefault();
            }
        } else if (e.code === 'Escape') {
            searchAddon.clearDecorations();
            dispatch({ type: 'setShowSearchBar', showSearchBar: false });
        } else if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
            if (showSearchBar) {
                sendSearchKeyEvent('focus');
            } else {
                dispatch({ type: 'setShowSearchBar', showSearchBar: true });
            }
            e.preventDefault();
        } else if (e.code === 'F3') {
            sendSearchKeyEvent(e.shiftKey ? 'previous' : 'next');
            e.preventDefault();
        }
    });

    //NOTE: quickfix for https://github.com/xtermjs/xterm.js/issues/4994
    const writeToTerminal = (data: string) => {
        const lines = data.split(/\r?\n/);
        //check if last line isn't empty
        //NOTE: i'm not trimming because having multiple \n at the end is valid
        if (lines.length && !lines[lines.length - 1]) {
            lines.pop();
        }
        //print each line
        for (const line of lines) {
            term.writeln(line);
        }
    };

    //Rendering stuff
    const pageTitle = 'Console Log';
    const pageSubtitle = 'Raw fxPanel process output, including startup and debug messages.';

    return (
        <div className="h-contentvh mx-auto flex w-full max-w-(--breakpoint-xl) flex-col gap-4 px-2 md:px-0">
            <PageHeader title={pageTitle} description={pageSubtitle} icon={<ScrollTextIcon />} />

            <div className="dark text-primary bg-card border-border/60 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
                <div className="bg-secondary/20 border-border/60 flex shrink-0 items-center gap-3 border-b px-4 py-3">
                    <div className="bg-secondary/50 text-accent/80 flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10">
                        <ScrollTextIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold">Captured terminal stream</p>
                        <p className="text-muted-foreground truncate text-xs">{pageSubtitle}</p>
                    </div>
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                    {/* Loading overlay */}
                    {isLoading && !loadError ? (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                            <div className="text-muted-foreground flex flex-col items-center justify-center gap-6 select-none">
                                <Loader2Icon className="size-16 animate-spin" />
                                <h2 className="animate-pulse text-3xl font-light tracking-wider">
                                    &nbsp;&nbsp;&nbsp;Loading…
                                </h2>
                            </div>
                        </div>
                    ) : null}
                    {loadError && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/60">
                            <h2 className="text-muted-foreground text-2xl font-light tracking-wider select-none">
                                Error fetching {pageTitle}:
                            </h2>
                            <p className="text-destructive-inline mx-8 max-w-(--breakpoint-md) font-mono">
                                {loadError}
                            </p>
                        </div>
                    )}

                    {/* Terminal container */}
                    <div ref={containerRef} className="absolute top-1 right-0 bottom-0 left-2" />

                    {/* Search bar */}
                    {showSearchBar ? <LiveConsoleSearchBar setShow={setShowSearchBar} searchAddon={searchAddon} /> : null}

                    {/* Scroll to bottom */}
                    <button
                        ref={jumpBottomBtnRef}
                        className="absolute right-2 bottom-0 z-10 hidden opacity-75"
                        onClick={() => {
                            term.scrollToBottom();
                        }}
                    >
                        <ChevronsDownIcon className="size-20 animate-pulse hover:scale-110 hover:animate-none" />
                    </button>
                </div>
            </div>
        </div>
    );
}
