import { txToast } from '@/components/TxToaster';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOpenPromptDialog } from '@/hooks/dialogs';
import { useLiveConsoleBookmarks, useLiveConsoleHistory } from '@/pages/LiveConsole/liveConsoleHooks';
import { cn, createDuplicateKeyResolver } from '@/lib/utils';
import { PlusIcon, StarIcon, StarOffIcon, XIcon } from 'lucide-react';

type SheetProps = {
    isOpen: boolean;
    closeSheet: () => void;
    toTermInput: (_cmd: string) => void;
};

function SheetBackdrop({ isOpen, closeSheet }: Omit<SheetProps, 'toTermInput'>) {
    return (
        <button
            type="button"
            aria-label="Close command sheet"
            className={cn(
                'absolute inset-0 z-20',
                'bg-black/60 duration-300',
                'data-[state=closed]:pointer-events-none data-[state=open]:pointer-events-auto',
                'data-[state=open]:opacity-100',
                'data-[state=closed]:opacity-0',
            )}
            data-state={isOpen ? 'open' : 'closed'}
            onClick={closeSheet}
        />
    );
}

function SheetCloseButton({ closeSheet }: Pick<SheetProps, 'closeSheet'>) {
    return (
        <button
            className="absolute top-4 right-4 cursor-pointer rounded-sm opacity-70 ring-0 transition-opacity hover:opacity-100 focus:outline-hidden"
            onClick={closeSheet}
            title="Close"
        >
            <XIcon className="size-8" />
        </button>
    );
}

type SheetCommandProps = {
    cmd: string;
    type: 'history' | 'saved';
    onClick: () => void;
    onFavAction: () => void;
};

function SheetCommand({ cmd, type, onClick, onFavAction }: SheetCommandProps) {
    const handleFavAction = (event: React.MouseEvent) => {
        event.stopPropagation();
        onFavAction();
    };

    return (
        <div
            onClick={onClick}
            className="bg-card hover:bg-muted group flex cursor-pointer items-center justify-between rounded-lg px-2 py-1"
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    if (event.key === ' ') event.preventDefault();
                    onClick();
                }
            }}
            role="button"
            tabIndex={0}
        >
            <span className="group-hover:text-primary line-clamp-4 py-1 font-mono">{cmd}</span>
            <div className="min-w-max">
                <button
                    type="button"
                    className="hover:bg-primary hover:text-primary-foreground invisible flex size-7 items-center justify-center rounded-lg group-hover:visible"
                    onClick={handleFavAction}
                >
                    {type === 'history' ? (
                        <>
                            <StarIcon className="size-5" />
                            <span className="sr-only">Save</span>
                        </>
                    ) : (
                        <>
                            <StarOffIcon className="size-5" />
                            <span className="sr-only">Remove</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

function SheetContent({ toTermInput }: Pick<SheetProps, 'toTermInput'>) {
    const { history, wipeHistory } = useLiveConsoleHistory();
    const { bookmarks, addBookmark, removeBookmark } = useLiveConsoleBookmarks();
    const openPromptDialog = useOpenPromptDialog();
    const getHistoryKey = createDuplicateKeyResolver();
    const getBookmarkKey = createDuplicateKeyResolver();

    const handleWipeHistory = () => {
        txToast.success('History cleared');
        wipeHistory();
    };
    const handleSaveCommand = () => {
        openPromptDialog({
            title: 'Save Command',
            message: 'Enter the command to save:',
            submitLabel: 'Save',
            onSubmit: (cmd) => {
                if (cmd) addBookmark(cmd);
            },
        });
    };
    return (
        <div className="flex max-h-full flex-row gap-4">
            <div className="flex w-1/2 grow flex-col gap-2">
                <h2 className="text-xl font-semibold">History</h2>
                <ScrollArea
                    className="text-muted-foreground max-h-full w-full pr-3 text-sm"
                    style={{ wordBreak: 'break-word' }}
                >
                    <button
                        onClick={handleWipeHistory}
                        className="bg-secondary hover:bg-primary hover:text-primary-foreground mb-2 w-full rounded-lg py-2 font-sans tracking-wider"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <XIcon className="inline size-4" />
                            Clear History
                        </div>
                    </button>
                    <div className="line-clamp-1 space-y-2 pb-4 font-mono text-sm tracking-wide">
                        {history.map((cmd) => (
                            <SheetCommand
                                key={getHistoryKey(cmd)}
                                cmd={cmd}
                                type="history"
                                onClick={() => toTermInput(cmd)}
                                onFavAction={() => addBookmark(cmd)}
                            />
                        ))}
                    </div>
                    {history.length === 0 && (
                        <div className="h-auto w-full text-center tracking-wider italic">
                            The command history is empty.
                        </div>
                    )}
                </ScrollArea>
            </div>
            <div className="flex w-1/2 grow flex-col gap-2">
                <h2 className="text-xl font-semibold">Saved</h2>
                <ScrollArea
                    className="text-muted-foreground max-h-full w-full pr-3 text-sm"
                    style={{ wordBreak: 'break-word' }}
                >
                    <button
                        onClick={handleSaveCommand}
                        className="bg-secondary hover:bg-primary hover:text-primary-foreground mb-2 w-full rounded-lg py-2 font-sans tracking-wider"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <PlusIcon className="inline size-4" />
                            Add New
                        </div>
                    </button>
                    <div className="line-clamp-1 space-y-2 pb-4 font-mono text-sm tracking-wide">
                        {bookmarks.map((cmd) => (
                            <SheetCommand
                                key={getBookmarkKey(cmd)}
                                cmd={cmd}
                                type="saved"
                                onClick={() => toTermInput(cmd)}
                                onFavAction={() => removeBookmark(cmd)}
                            />
                        ))}
                    </div>
                    {bookmarks.length === 0 && (
                        <div className="h-auto w-full text-center tracking-wider italic">
                            There are no saved commands. <br />
                            To save a command, click the star icon next to it.
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
    );
}

export default function LiveConsoleSaveSheet({ isOpen, closeSheet, toTermInput }: SheetProps) {
    return (
        <>
            <SheetBackdrop isOpen={isOpen} closeSheet={closeSheet} />
            <div
                data-state={isOpen ? 'open' : 'closed'}
                className={cn(
                    'absolute inset-y-0 z-20 w-full md:max-w-2xl',
                    'bg-background border-l px-4 pt-6 shadow-lg',
                    'data-[state=closed]:pointer-events-none data-[state=open]:pointer-events-auto',
                    'transition-all duration-300 ease-in-out',
                    isOpen ? 'right-0 opacity-100' : '-right-full opacity-0',
                )}
            >
                <SheetCloseButton closeSheet={closeSheet} />
                <SheetContent toTermInput={toTermInput} />
            </div>
        </>
    );
}
