import { useState } from 'react';
import type { DatabaseActionType } from '../../../../core/modules/Database/databaseTypes';
import { Button } from '@/components/ui/button';
import { GenericApiOkResp } from '@shared/genericApiTypes';
import { useAdminPerms } from '@/hooks/auth';
import { Loader2Icon } from 'lucide-react';
import { useBackendApi } from '@/hooks/fetch';
import { useOpenConfirmDialog } from '@/hooks/dialogs';
import { useActionModalStateValue } from '@/hooks/actionModal';
import type { ApiRevokeActionReqSchema, ApiDeleteActionReqSchema } from '@shared/otherTypes';

type ActionModifyTabProps = {
    action: DatabaseActionType;
    refreshModalData: () => void;
};

export default function ActionModifyTab({ action, refreshModalData }: ActionModifyTabProps) {
    const [isRevoking, setIsRevoking] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [revokeReason, setRevokeReason] = useState('');
    const { hasPerm } = useAdminPerms();
    const { closeModal } = useActionModalStateValue();
    const openConfirmDialog = useOpenConfirmDialog();

    const revokeActionApi = useBackendApi<GenericApiOkResp, ApiRevokeActionReqSchema>({
        method: 'POST',
        path: `/history/revokeAction`,
    });

    const deleteActionApi = useBackendApi<GenericApiOkResp, ApiDeleteActionReqSchema>({
        method: 'POST',
        path: `/history/deleteAction`,
    });

    const upperCasedType = action.type.charAt(0).toUpperCase() + action.type.slice(1);
    const doRevokeAction = () => {
        setIsRevoking(true);
        revokeActionApi({
            data: {
                actionId: action.id,
                ...(revokeReason.trim() ? { reason: revokeReason.trim() } : {}),
            },
            toastLoadingMessage: `Revoking ${action.type}…`,
            genericHandler: {
                successMsg: `${upperCasedType} revoked.`,
            },
            success: (data) => {
                setIsRevoking(false);
                if ('success' in data) {
                    refreshModalData();
                }
            },
        });
    };

    const isAlreadyRevoked = !!action.revocation;
    const hasRevokePerm = hasPerm(action.type === 'warn' ? 'players.warn' : 'players.unban');
    const hasDeletePerm = hasPerm('players.delete');
    const revokeBtnLabel = isAlreadyRevoked
        ? `${action.type} revoked`
        : hasRevokePerm
          ? `Revoke ${upperCasedType}`
          : 'Revoke (no permission)';

    const doDeleteAction = () => {
        openConfirmDialog({
            title: `Delete ${upperCasedType}`,
            message: (
                <p>
                    Are you sure you want to permanently delete this {action.type}?<br />
                    <strong>This will remove it from the player&apos;s history entirely and cannot be undone.</strong>
                </p>
            ),
            onConfirm: () => {
                setIsDeleting(true);
                deleteActionApi({
                    data: { actionId: action.id },
                    toastLoadingMessage: `Deleting ${action.type}…`,
                    genericHandler: {
                        successMsg: `${upperCasedType} deleted.`,
                    },
                    success: (data) => {
                        setIsDeleting(false);
                        if ('success' in data) {
                            closeModal();
                        }
                    },
                });
            },
        });
    };

    return (
        <div className="mb-1 flex flex-col gap-4 px-1 md:mb-4">
            <div className="space-y-2">
                <h3 className="text-xl">Revoke {upperCasedType}</h3>
                <p className="text-muted-foreground text-sm">
                    This is generally done when the player successfully appeals the {action.type} or the admin regrets
                    issuing it.
                    <ul className="list-inside list-disc pt-1">
                        {action.type === 'ban' && <li>The player will be able to rejoin the server.</li>}
                        <li>The player will not be notified of the revocation.</li>
                        <li>This {action.type} will not be removed from the player history.</li>
                        <li>The revocation cannot be undone!</li>
                    </ul>
                </p>

                <textarea
                    className="border-border bg-background placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="Revocation reason (optional)"
                    rows={2}
                    maxLength={512}
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    disabled={isAlreadyRevoked || !hasRevokePerm}
                />

                <Button
                    variant="destructive"
                    size="xs"
                    className="xs:col-span-3 xs:col-start-2 col-span-full col-start-1"
                    type="submit"
                    disabled={isAlreadyRevoked || !hasRevokePerm || isRevoking}
                    onClick={doRevokeAction}
                >
                    {isRevoking ? (
                        <span className="flex items-center leading-relaxed">
                            <Loader2Icon className="inline h-4 animate-spin" /> Revoking…
                        </span>
                    ) : (
                        revokeBtnLabel
                    )}
                </Button>
            </div>

            {action.type !== 'kick' && (
                <div className="border-border space-y-2 border-t pt-4">
                    <h3 className="text-xl">Delete {upperCasedType}</h3>
                    <p className="text-muted-foreground text-sm">
                        Permanently removes this {action.type} from the database.
                        <ul className="list-inside list-disc pt-1">
                            <li>This will be removed from the player&apos;s history entirely.</li>
                            <li>This action cannot be undone!</li>
                        </ul>
                    </p>
                    <Button
                        variant="destructive"
                        size="xs"
                        disabled={!hasDeletePerm || isDeleting}
                        onClick={doDeleteAction}
                    >
                        {isDeleting ? (
                            <span className="flex items-center leading-relaxed">
                                <Loader2Icon className="inline h-4 animate-spin" /> Deleting…
                            </span>
                        ) : hasDeletePerm ? (
                            `Delete ${upperCasedType}`
                        ) : (
                            'Delete (no permission)'
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
