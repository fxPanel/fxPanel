import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useActionModalStateValue } from '@/hooks/actionModal';
import { InfoIcon, ListIcon, PencilIcon, Undo2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import GenericSpinner from '@/components/GenericSpinner';
import { cn } from '@/lib/utils';
import { useBackendApi } from '@/hooks/fetch';
import ModalCentralMessage from '@/components/ModalCentralMessage';
import { HistoryActionModalResp, HistoryActionModalSuccess } from '@shared/historyApiTypes';
import ActionIdsTab from './ActionIdsTab';
import ActionInfoTab from './ActionInfoTab';
import ActionEditTab from './ActionEditTab';
import ActionModifyTab from './ActionModifyTab';
import type { DatabaseActionType } from '../../../../core/modules/Database/databaseTypes';

type ModalTab = {
    title: string;
    icon: React.ReactNode;
    className?: string;
};

const baseTabs: ModalTab[] = [
    {
        title: 'Info',
        icon: <InfoIcon className="xs:block mr-2 hidden size-5" />,
    },
    {
        title: 'IDs',
        icon: <ListIcon className="xs:block mr-2 hidden size-5" />,
    },
];

const editTab: ModalTab = {
    title: 'Edit',
    icon: <PencilIcon className="xs:block mr-2 hidden size-5" />,
};

const revokeTab: ModalTab = {
    title: 'Revoke',
    icon: <Undo2Icon className="xs:block mr-2 hidden size-5" />,
    className: 'hover:bg-destructive hover:text-destructive-foreground',
};

const getTabsForAction = (action?: DatabaseActionType): ModalTab[] => {
    if (!action) return [...baseTabs, revokeTab];
    if (action.type === 'ban') return [...baseTabs, editTab, revokeTab];
    return [...baseTabs, revokeTab];
};

export default function ActionModal() {
    const { isModalOpen, closeModal, actionRef } = useActionModalStateValue();
    const [selectedTab, setSelectedTab] = useState('Info');
    const [currRefreshKey, setCurrRefreshKey] = useState(0);
    const [modalData, setModalData] = useState<HistoryActionModalSuccess | undefined>(undefined);
    const [modalError, setModalError] = useState('');
    const [tsFetch, setTsFetch] = useState(0);
    const historyGetActionApi = useBackendApi<HistoryActionModalResp>({
        method: 'GET',
        path: `/history/action`,
        abortOnUnmount: true,
    });

    //Helper for tabs to be able to refresh the modal data
    const refreshModalData = () => {
        setCurrRefreshKey(currRefreshKey + 1);
    };

    //Querying Action data when reference is available
    useEffect(() => {
        if (!actionRef) return;
        setModalData(undefined);
        setModalError('');
        historyGetActionApi({
            queryParams: { id: actionRef },
            success: (resp) => {
                if ('error' in resp) {
                    setModalError(resp.error);
                } else {
                    setModalData(resp);
                    setTsFetch(Math.round(Date.now() / 1000));
                }
            },
            error: (error) => {
                setModalError(error);
            },
        });
    }, [actionRef, currRefreshKey]);

    //Resetting selected tab when modal is closed
    useEffect(() => {
        if (!isModalOpen) {
            setTimeout(() => {
                setSelectedTab('Info');
            }, 200);
        }
    }, [isModalOpen]);

    const handleOpenClose = (newOpenState: boolean) => {
        if (isModalOpen && !newOpenState) {
            closeModal();
        }
    };

    const modalTabs = useMemo(() => getTabsForAction(modalData?.action), [modalData?.action]);

    //move to tab up or down
    const handleTabButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const currentIndex = modalTabs.findIndex((tab) => tab.title === selectedTab);
            const nextIndex = e.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1;
            const nextTab = modalTabs[nextIndex];
            if (nextTab) {
                setSelectedTab(nextTab.title);
                const nextButton = document.getElementById(`action-modal-tab-${nextTab.title}`);
                if (nextButton) {
                    nextButton.focus();
                }
            }
        }
    };

    let pageTitle: JSX.Element;
    if (modalData) {
        const displayName =
            modalData.action.playerName !== false ? (
                <span>{modalData.action.playerName}</span>
            ) : (
                <span className="italic opacity-75">unknown player</span>
            );
        if (modalData.action.type === 'ban') {
            pageTitle = (
                <>
                    <span className="text-destructive-inline mr-2 font-mono">[{modalData.action.id}]</span>
                    Banned {displayName}
                </>
            );
        } else if (modalData.action.type === 'warn') {
            pageTitle = (
                <>
                    <span className="text-warning-inline mr-2 font-mono">[{modalData.action.id}]</span>
                    Warned {displayName}
                </>
            );
        } else if (modalData.action.type === 'kick') {
            pageTitle = (
                <>
                    <span className="text-muted-foreground mr-2 font-mono">[{modalData.action.id}]</span>
                    Kicked {displayName}
                </>
            );
        } else {
            throw new Error(`Unknown action type: ${modalData.action.type}`);
        }
    } else if (modalError) {
        pageTitle = <span className="text-destructive-inline">Error!</span>;
    } else {
        pageTitle = <span className="text-muted-foreground italic">Loading...</span>;
    }

    return (
        <Dialog open={isModalOpen} onOpenChange={handleOpenClose}>
            <DialogContent
                className="flex h-full max-h-full max-w-2xl flex-col gap-1 p-0 sm:h-auto sm:gap-4"
                // onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader className="border-b px-4 py-3">
                    <DialogTitle className="mr-6 line-clamp-1 leading-7 tracking-wide break-all">
                        {pageTitle}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex h-full flex-col md:flex-row md:px-4">
                    <div className="bg-muted mx-2 flex flex-row gap-1 rounded-md p-1 md:mx-0 md:flex-col md:bg-transparent md:p-0">
                        {modalTabs.map((tab) => (
                            <Button
                                id={`action-modal-tab-${tab.title}`}
                                key={tab.title}
                                variant={selectedTab === tab.title ? 'secondary' : 'ghost'}
                                className={cn(
                                    'w-full justify-center tracking-wider md:justify-start',
                                    'h-7 rounded-sm px-2 text-sm',
                                    'md:h-10 md:text-base',
                                    // @ts-ignore annoying, remove this when adding some class to any of the tabs
                                    tab.className,
                                )}
                                onClick={() => setSelectedTab(tab.title)}
                                onKeyDown={handleTabButtonKeyDown}
                            >
                                {tab.icon} {tab.title}
                            </Button>
                        ))}
                    </div>
                    {/* NOTE: consistent height: sm:h-66 */}
                    <ScrollArea className="max-h-[calc(100dvh-3.125rem-4rem)] min-h-66 w-full px-4 py-2 md:max-h-[50vh] md:py-0">
                        {!modalData ? (
                            <ModalCentralMessage>
                                {modalError ? (
                                    <span className="text-destructive-inline">Error: {modalError}</span>
                                ) : (
                                    <GenericSpinner msg="Loading..." />
                                )}
                            </ModalCentralMessage>
                        ) : (
                            <>
                                {selectedTab === 'Info' && (
                                    <ActionInfoTab
                                        action={modalData.action}
                                        serverTime={modalData.serverTime}
                                        tsFetch={tsFetch}
                                    />
                                )}
                                {selectedTab === 'IDs' && <ActionIdsTab action={modalData.action} />}
                                {selectedTab === 'Edit' && modalData.action.type === 'ban' && (
                                    <ActionEditTab action={modalData.action} refreshModalData={refreshModalData} />
                                )}
                                {selectedTab === 'Revoke' && (
                                    <ActionModifyTab action={modalData.action} refreshModalData={refreshModalData} />
                                )}
                            </>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
