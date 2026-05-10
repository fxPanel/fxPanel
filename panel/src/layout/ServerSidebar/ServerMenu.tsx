import { MenuNavLink } from '@/components/MainPageLink';
import TxAnchor from '@/components/TxAnchor';
import { useAdminPerms } from '@/hooks/auth';
import { useAddonLoader } from '@/hooks/addons';
import { serverNameAtom, txConfigStateAtom } from '@/hooks/status';
import { useContentRefresh } from '@/hooks/pages';
import { cn } from '@/lib/utils';
import { TxConfigState } from '@shared/enums';
import { useAtomValue } from 'jotai';
import {
    BlocksIcon,
    BoxIcon,
    ChevronRightSquareIcon,
    DnaIcon,
    EyeIcon,
    FileEditIcon,
    HourglassIcon,
    LayoutDashboardIcon,
} from 'lucide-react';
import { useEffect, useReducer } from 'react';
import { useLocation } from 'wouter';

type PendingConfigureLinkState = {
    linkHref: string;
    linkText: string;
};

function reducePendingConfigureLinkState(
    state: PendingConfigureLinkState,
    action: Partial<PendingConfigureLinkState>,
): PendingConfigureLinkState {
    return {
        ...state,
        ...action,
    };
}

//Separate component to prevent re-render of the entire menu
function ServerName() {
    return useAtomValue(serverNameAtom);
}

type PendingServerConfigureProps = {
    txConfigState?: Exclude<TxConfigState, TxConfigState.Ready>;
};

function PendingServerConfigure({ txConfigState }: PendingServerConfigureProps) {
    const [currLocation] = useLocation();
    const [state, dispatch] = useReducer(reducePendingConfigureLinkState, {
        linkHref: '',
        linkText: '',
    });
    const { linkHref, linkText } = state;
    const refreshContent = useContentRefresh();

    //This effect is done to prevent the link from popping up in the delay between ui change
    // and the pendingStep state atom being updated from the socket.io event
    useEffect(() => {
        let newHref = '';
        let newLinkText = '';
        if (txConfigState === TxConfigState.Setup && !currLocation.startsWith('/server/setup')) {
            newHref = '/server/setup';
            newLinkText = 'Go to the setup page!';
        } else if (txConfigState === TxConfigState.Deployer && !currLocation.startsWith('/server/deployer')) {
            newHref = '/server/deployer';
            newLinkText = 'Go to the deployer page!';
        } else {
            newHref = '';
        }

        if (!newHref) {
            dispatch({ linkHref: '', linkText: newLinkText });
            return;
        } else {
            const timeout = setTimeout(() => {
                dispatch({ linkHref: newHref, linkText: newLinkText });
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [currLocation, txConfigState]);

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <HourglassIcon className="size-12 animate-pulse opacity-75" />
            <p className="text-center text-lg font-light tracking-wider opacity-75">
                You need to configure your server to be able to start it.
            </p>
            {linkHref ? (
                <TxAnchor href={linkHref} className="animate-toastbar-enter" onClick={() => refreshContent()}>
                    {linkText}
                </TxAnchor>
            ) : (
                <TxAnchor href="#" className="animate-toastbar-leave pointer-events-none">
                    {linkText || <>&nbsp;</>}
                </TxAnchor>
            )}
        </div>
    );
}

export default function ServerMenu() {
    const txConfigState = useAtomValue(txConfigStateAtom);
    const { hasPerm } = useAdminPerms();
    const { pages: addonPages } = useAddonLoader();
    const sidebarAddonPages = addonPages.filter((p) => p.sidebar === true);

    const isConfigPending = txConfigState !== TxConfigState.Ready;
    return (
        <div className="relative">
            {isConfigPending && <PendingServerConfigure txConfigState={txConfigState} />}
            <div className={cn(isConfigPending && 'pointer-events-none opacity-0')}>
                <h2 className="mb-1.5 line-clamp-1 text-lg font-semibold tracking-tight">
                    <ServerName />
                </h2>
                <div className="space-y-1 select-none">
                    <MenuNavLink href="/">
                        <LayoutDashboardIcon className="mr-2 size-4" />
                        Dashboard
                    </MenuNavLink>
                    <MenuNavLink href="/server/console" disabled={!hasPerm('console.view')}>
                        <ChevronRightSquareIcon className="mr-2 size-4" />
                        Live Console
                    </MenuNavLink>
                    <MenuNavLink href="/server/resources">
                        <BoxIcon className="mr-2 size-4" />
                        Resources
                    </MenuNavLink>
                    <MenuNavLink href="/server/server-log" disabled={!hasPerm('server.log.view')}>
                        <EyeIcon className="mr-2 size-4" />
                        Server Log
                    </MenuNavLink>
                    <MenuNavLink href="/server/cfg-editor" disabled={!hasPerm('server.cfg.editor')}>
                        <FileEditIcon className="mr-2 size-4" />
                        CFG Editor
                    </MenuNavLink>
                    {window.txConsts.showAdvanced && (
                        <MenuNavLink href="/advanced" className="text-accent" disabled={!hasPerm('all_permisisons')}>
                            <DnaIcon className="mr-2 size-4" />
                            Advanced
                        </MenuNavLink>
                    )}
                    {sidebarAddonPages.length > 0 && (
                        <>
                            <hr className="border-border my-1.5" />
                            {sidebarAddonPages.map((page) => (
                                <MenuNavLink
                                    key={page.path}
                                    href={page.path}
                                    disabled={page.permission ? !hasPerm(page.permission) : false}
                                >
                                    <BlocksIcon className="mr-2 size-4" />
                                    {page.title}
                                </MenuNavLink>
                            ))}
                        </>
                    )}
                    {import.meta.env.DEV && (
                        <MenuNavLink href="/test" className="text-accent">
                            <DnaIcon className="mr-2 size-4" />
                            Test
                        </MenuNavLink>
                    )}
                </div>
            </div>
        </div>
    );
}
