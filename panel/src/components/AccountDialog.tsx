import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useAdminPerms } from '@/hooks/auth';
import { memo, useEffect, useReducer, useState } from 'react';
import { TabsTrigger, TabsList, TabsContent, Tabs } from '@/components/ui/tabs';
import {
    ApiChangeIdentifiersReq,
    ApiChangePasswordReq,
    ApiTotpSetupResp,
    ApiTotpConfirmResp,
    ApiTotpDisableResp,
} from '@shared/authApiTypes';
import { useAccountModal, useCloseAccountModal } from '@/hooks/dialogs';
import { GenericApiOkResp } from '@shared/genericApiTypes';
import { ApiTimeout, fetchWithTimeout, useAuthedFetcher, useBackendApi } from '@/hooks/fetch';
import consts from '@shared/consts';
import { txToast } from './TxToaster';
import useSWR from 'swr';
import TxAnchor from './TxAnchor';
import QRCode from 'qrcode';

type ChangeIdentifiersState = {
    cfxreId: string;
    discordId: string;
    error: string;
    isConvertingFivemId: boolean;
    isSaving: boolean;
};

function reduceChangeIdentifiersState(
    state: ChangeIdentifiersState,
    action: Partial<ChangeIdentifiersState>,
): ChangeIdentifiersState {
    return {
        ...state,
        ...action,
    };
}

type TwoFactorStep = 'status' | 'setup' | 'backup' | 'disable';

type TwoFactorState = {
    step: TwoFactorStep;
    setupSecret: string;
    qrDataUrl: string;
    verifyCode: string;
    backupCodes: string[];
    disablePassword: string;
    disableCode: string;
    error: string;
    isProcessing: boolean;
};

function reduceTwoFactorState(state: TwoFactorState, action: Partial<TwoFactorState>): TwoFactorState {
    return {
        ...state,
        ...action,
    };
}

function TwoFactorStatusStep({
    enabled,
    error,
    isProcessing,
    onStartSetup,
    onStartDisable,
}: {
    enabled: boolean;
    error: string;
    isProcessing: boolean;
    onStartSetup: () => void;
    onStartDisable: () => void;
}) {
    return (
        <div>
            <p className="text-muted-foreground text-sm">
                Two-factor authentication adds an extra layer of security to your account by requiring a code from your
                authenticator app when logging in.
            </p>
            <div className="mt-4 flex items-center justify-between rounded-md border p-3">
                <div>
                    <p className="text-sm font-medium">2FA Status</p>
                    <p className={`text-sm ${enabled ? 'text-success' : 'text-muted-foreground'}`}>
                        {enabled ? 'Enabled' : 'Disabled'}
                    </p>
                </div>
                {enabled ? (
                    <Button variant="destructive" size="sm" onClick={onStartDisable}>
                        Disable 2FA
                    </Button>
                ) : (
                    <Button size="sm" onClick={onStartSetup} disabled={isProcessing}>
                        {isProcessing ? 'Loading...' : 'Enable 2FA'}
                    </Button>
                )}
            </div>
            {error && <p className="text-destructive mt-2 text-center text-sm">{error}</p>}
        </div>
    );
}

function TwoFactorSetupStep({
    setupSecret,
    qrDataUrl,
    verifyCode,
    error,
    isProcessing,
    onCodeChange,
    onCancel,
    onConfirm,
}: {
    setupSecret: string;
    qrDataUrl: string;
    verifyCode: string;
    error: string;
    isProcessing: boolean;
    onCodeChange: (code: string) => void;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div>
            <p className="text-muted-foreground mb-3 text-sm">
                Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.), then enter the
                6-digit code to verify.
            </p>
            <div className="mb-3 flex justify-center">
                {qrDataUrl ? (
                    <img src={qrDataUrl} alt="TOTP QR Code" className="rounded-md border" width={200} height={200} />
                ) : (
                    <p className="text-muted-foreground text-sm">QR code unavailable. Enter the key manually below.</p>
                )}
            </div>
            <div className="mb-3">
                <p className="text-muted-foreground mb-1 text-xs">Can't scan? Enter this key manually:</p>
                <code className="bg-muted block rounded p-2 text-center font-mono text-xs break-all select-all">
                    {setupSecret}
                </code>
            </div>
            <div className="space-y-2">
                <Label htmlFor="totp-verify-code">Verification Code</Label>
                <Input
                    id="totp-verify-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => onCodeChange(e.target.value)}
                />
            </div>
            {error && <p className="text-destructive mt-2 text-center text-sm">{error}</p>}
            <div className="mt-4 flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={onCancel}>
                    Cancel
                </Button>
                <Button className="flex-1" onClick={onConfirm} disabled={isProcessing}>
                    {isProcessing ? 'Verifying...' : 'Verify & Enable'}
                </Button>
            </div>
        </div>
    );
}

function TwoFactorBackupStep({
    backupCodes,
    onCopy,
    onFinish,
}: {
    backupCodes: string[];
    onCopy: () => void;
    onFinish: () => void;
}) {
    return (
        <div>
            <p className="text-warning-inline mb-3 text-sm font-medium">
                Save these backup codes in a safe place. Each code can only be used once. You won't be able to see them
                again.
            </p>
            <div className="bg-muted mb-3 rounded-md p-3">
                <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                    {backupCodes.map((code) => (
                        <div key={code} className="text-center">
                            {code}
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onCopy}>
                    Copy Codes
                </Button>
                <Button className="flex-1" onClick={onFinish}>
                    Finish setup
                </Button>
            </div>
        </div>
    );
}

function TwoFactorDisableStep({
    disablePassword,
    disableCode,
    error,
    isProcessing,
    onPasswordChange,
    onCodeChange,
    onCancel,
    onDisable,
}: {
    disablePassword: string;
    disableCode: string;
    error: string;
    isProcessing: boolean;
    onPasswordChange: (password: string) => void;
    onCodeChange: (code: string) => void;
    onCancel: () => void;
    onDisable: () => void;
}) {
    return (
        <div>
            <p className="text-muted-foreground mb-3 text-sm">
                To disable two-factor authentication, enter your current password and a 2FA code.
            </p>
            <div className="space-y-3 pb-4">
                <div className="space-y-1">
                    <Label htmlFor="disable-password">Password</Label>
                    <Input
                        id="disable-password"
                        type="password"
                        placeholder="Enter your password"
                        value={disablePassword}
                        onChange={(e) => onPasswordChange(e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="disable-code">2FA Code</Label>
                    <Input
                        id="disable-code"
                        type="text"
                        inputMode="numeric"
                        placeholder="000000"
                        maxLength={6}
                        value={disableCode}
                        onChange={(e) => onCodeChange(e.target.value)}
                    />
                </div>
            </div>
            {error && <p className="text-destructive -mt-2 mb-4 text-center text-sm">{error}</p>}
            <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={onCancel}>
                    Cancel
                </Button>
                <Button variant="destructive" className="flex-1" onClick={onDisable} disabled={isProcessing}>
                    {isProcessing ? 'Disabling...' : 'Disable 2FA'}
                </Button>
            </div>
        </div>
    );
}

/**
 * Change Password tab
 */
const ChangePasswordTab = memo(function () {
    const { authData, setAuthData } = useAuth();
    const { setAccountModalTab } = useAccountModal();
    const closeAccountModal = useCloseAccountModal();
    const changePasswordApi = useBackendApi<GenericApiOkResp, ApiChangePasswordReq>({
        method: 'POST',
        path: '/auth/changePassword',
    });

    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        if (!authData) return;
        setError('');

        if (newPassword.length < consts.adminPasswordMinLength || newPassword.length > consts.adminPasswordMaxLength) {
            setError(
                `The password must be between ${consts.adminPasswordMinLength} and ${consts.adminPasswordMaxLength} digits long.`,
            );
            return;
        } else if (newPassword !== newPasswordConfirm) {
            setError('The passwords do not match.');
            return;
        }

        setIsSaving(true);
        changePasswordApi({
            data: {
                newPassword,
                oldPassword: authData.isTempPassword ? undefined : oldPassword,
            },
            error: (error) => {
                setIsSaving(false);
                setError(error);
            },
            success: (data) => {
                setIsSaving(false);
                if ('success' in data) {
                    if (authData.isTempPassword) {
                        setAccountModalTab('identifiers');
                        setAuthData((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      isTempPassword: false,
                                  }
                                : prev,
                        );
                    } else {
                        txToast.success('Password changed successfully!');
                        closeAccountModal();
                    }
                } else {
                    setError(data.error);
                }
            },
        });
    };

    if (!authData) return;
    return (
        <TabsContent value="password" tabIndex={undefined}>
            <form onSubmit={handleSubmit}>
                {authData.isTempPassword ? (
                    <p className="text-warning-inline text-sm">
                        Your account has a temporary password that needs to be changed before you can use this web
                        panel. <br />
                        <strong>Make sure to take note of your new password before saving.</strong>
                    </p>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        You can use your password to login to the fxPanel interface even without using the Cfx.re login
                        button.
                    </p>
                )}
                <div className="space-y-3 pt-2 pb-6">
                    {!authData.isTempPassword && (
                        <div className="space-y-1">
                            <Label htmlFor="current-password">Current Password</Label>
                            <Input
                                id="current-password"
                                placeholder="Enter current password"
                                type="password"
                                value={oldPassword}
                                required
                                onChange={(e) => {
                                    setOldPassword(e.target.value);
                                    setError('');
                                }}
                            />
                        </div>
                    )}
                    <div className="space-y-1">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                            id="new-password"
                            autoComplete="new-password"
                            placeholder="Enter new password"
                            type="password"
                            value={newPassword}
                            required
                            onChange={(e) => {
                                setNewPassword(e.target.value);
                                setError('');
                            }}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                            id="confirm-password"
                            autoComplete="new-password"
                            placeholder="Repeat new password"
                            type="password"
                            required
                            onChange={(e) => {
                                setNewPasswordConfirm(e.target.value);
                                setError('');
                            }}
                        />
                    </div>
                </div>

                {error && <p className="text-destructive -mt-2 mb-4 text-center">{error}</p>}
                <Button className="w-full" type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : authData.isTempPassword ? 'Save & Next' : 'Change Password'}
                </Button>
            </form>
        </TabsContent>
    );
});

/**
 * Change Identifiers tab
 */
function ChangeIdentifiersTab() {
    const authedFetcher = useAuthedFetcher();
    const [state, dispatch] = useReducer(reduceChangeIdentifiersState, {
        cfxreId: '',
        discordId: '',
        error: '',
        isConvertingFivemId: false,
        isSaving: false,
    });
    const { cfxreId, discordId, error, isConvertingFivemId, isSaving } = state;
    const closeAccountModal = useCloseAccountModal();

    const currIdsResp = useSWR<ApiChangeIdentifiersReq>(
        '/auth/getIdentifiers',
        () => authedFetcher<ApiChangeIdentifiersReq>('/auth/getIdentifiers'),
        {
            //the data min interval is 5 mins, so we can safely cache for 1 min
            revalidateOnMount: true,
            revalidateOnFocus: false,
        },
    );

    useEffect(() => {
        if (!currIdsResp.data) return;
        dispatch({
            cfxreId: currIdsResp.data.cfxreId,
            discordId: currIdsResp.data.discordId,
        });
    }, [currIdsResp.data]);

    useEffect(() => {
        dispatch({ error: currIdsResp.error?.message ?? '' });
    }, [currIdsResp.error]);

    const changeIdentifiersApi = useBackendApi<GenericApiOkResp, ApiChangeIdentifiersReq>({
        method: 'POST',
        path: '/auth/changeIdentifiers',
    });

    const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        dispatch({ error: '', isSaving: true });
        changeIdentifiersApi({
            data: { cfxreId, discordId },
            error: (error) => {
                dispatch({ error, isSaving: false });
            },
            success: (data) => {
                if ('success' in data) {
                    txToast.success('Identifiers changed successfully!');
                    closeAccountModal();
                } else {
                    dispatch({ error: data.error, isSaving: false });
                }
            },
        });
    };

    const handleCfxreIdBlur = async () => {
        if (!cfxreId) return;
        const trimmed = cfxreId.trim();
        if (/^\d+$/.test(trimmed)) {
            dispatch({ cfxreId: `fivem:${trimmed}` });
        } else if (!trimmed.startsWith('fivem:')) {
            try {
                dispatch({ isConvertingFivemId: true });
                const forumData = await fetchWithTimeout(`https://forum.cfx.re/u/${trimmed}.json`);
                if (forumData.user && typeof forumData.user.id === 'number') {
                    dispatch({ cfxreId: `fivem:${forumData.user.id}` });
                } else {
                    dispatch({ error: 'Could not find the user in the forum. Make sure you typed the username correctly.' });
                }
            } catch {
                dispatch({ error: 'Failed to check the identifiers on the forum API.' });
            } finally {
                dispatch({ isConvertingFivemId: false });
            }
        } else if (cfxreId !== trimmed) {
            dispatch({ cfxreId: trimmed });
        }
    };

    const handleDiscordIdBlur = () => {
        if (!discordId) return;
        const trimmed = discordId.trim();
        if (/^\d+$/.test(trimmed)) {
            dispatch({ discordId: `discord:${trimmed}` });
        } else if (discordId !== trimmed) {
            dispatch({ discordId: trimmed });
        }
    };

    return (
        <TabsContent value="identifiers" tabIndex={undefined}>
            <form onSubmit={handleSubmit}>
                <p className="text-muted-foreground text-sm">
                    The identifiers are optional for accessing the <strong>Web Panel</strong> but required for you to be
                    able to use the <strong>In Game Menu</strong> and the <strong>Discord Bot</strong>. <br />
                    <strong>It is recommended that you configure at least one.</strong>
                </p>
                <div className="space-y-3 pt-2 pb-6">
                    <div className="space-y-1">
                        <Label htmlFor="cfxreId">
                            FiveM identifier <span className="text-info text-sm opacity-75">(optional)</span>
                        </Label>
                        <Input
                            id="cfxreId"
                            autoCapitalize="none"
                            autoComplete="off"
                            autoCorrect="off"
                            placeholder="fivem:000000"
                            value={currIdsResp.isLoading || isConvertingFivemId ? 'loading...' : cfxreId}
                            disabled={currIdsResp.isLoading || isConvertingFivemId}
                            onBlur={handleCfxreIdBlur}
                            onChange={(e) => {
                                dispatch({ cfxreId: e.target.value, error: '' });
                            }}
                        />
                        <p className="text-muted-foreground text-sm">
                            Your identifier can be found by clicking in your name in the playerlist and going to the IDs
                            page. <br />
                            You can also type in your <TxAnchor href="https://forum.cfx.re/">
                                forum.cfx.re
                            </TxAnchor>{' '}
                            username and it will be converted automatically. <br />
                            This is required if you want to login using the Cfx.re button.
                        </p>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="discordId">
                            Discord identifier <span className="text-info text-sm opacity-75">(optional)</span>
                        </Label>
                        <Input
                            id="discordId"
                            autoCapitalize="none"
                            autoComplete="off"
                            autoCorrect="off"
                            placeholder="discord:000000000000000000"
                            value={currIdsResp.isLoading ? 'loading...' : discordId}
                            disabled={currIdsResp.isLoading}
                            onBlur={handleDiscordIdBlur}
                            onChange={(e) => {
                                dispatch({ discordId: e.target.value, error: '' });
                            }}
                        />
                        <p className="text-muted-foreground text-sm">
                            You can get your Discord User ID by following{' '}
                            <TxAnchor href="https://support.discordapp.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID">
                                this guide
                            </TxAnchor>
                            . <br />
                            This is required if you want to use the Discord Bot slash commands.
                        </p>
                    </div>
                </div>

                {error && <p className="text-destructive -mt-2 mb-4 text-center">{error}</p>}
                <Button className="w-full" type="submit" disabled={!currIdsResp || isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </form>
        </TabsContent>
    );
}

/**
 * Two-Factor Authentication tab
 */
function TwoFactorTab() {
    const { authData, setAuthData } = useAuth();
    const closeAccountModal = useCloseAccountModal();

    const [state, dispatch] = useReducer(reduceTwoFactorState, {
        step: 'status',
        setupSecret: '',
        qrDataUrl: '',
        verifyCode: '',
        backupCodes: [],
        disablePassword: '',
        disableCode: '',
        error: '',
        isProcessing: false,
    });
    const { step, setupSecret, qrDataUrl, verifyCode, backupCodes, disablePassword, disableCode, error, isProcessing } =
        state;

    const authedFetcher = useAuthedFetcher();
    const safeAuthData = authData && typeof authData === 'object' ? authData : null;

    const is2faEnabled = safeAuthData?.totpEnabled ?? false;

    const handleStartSetup = async () => {
        dispatch({ error: '', isProcessing: true });
        try {
            const data = await authedFetcher<ApiTotpSetupResp>('/auth/totp/setup', {
                method: 'POST',
            });
            if ('error' in data) {
                dispatch({ error: data.error });
            } else {
                let dataUrl = '';
                try {
                    dataUrl = await QRCode.toDataURL(data.uri, { width: 200, margin: 2 });
                } catch {
                    // QR generation failed - user can still manually enter
                }
                dispatch({
                    setupSecret: data.secret,
                    qrDataUrl: dataUrl,
                    step: 'setup',
                });
            }
        } catch {
            dispatch({ error: 'Failed to start 2FA setup.' });
        } finally {
            dispatch({ isProcessing: false });
        }
    };

    const handleConfirmSetup = async () => {
        if (!verifyCode.trim()) return;
        dispatch({ error: '', isProcessing: true });
        try {
            const data = await authedFetcher<ApiTotpConfirmResp>('/auth/totp/confirm', {
                method: 'POST',
                body: { code: verifyCode.trim() },
            });
            if ('error' in data) {
                dispatch({ error: data.error });
            } else {
                dispatch({ backupCodes: data.backupCodes, step: 'backup' });
                setAuthData((prev) =>
                    prev
                        ? {
                              ...prev,
                              totpEnabled: true,
                          }
                        : prev,
                );
            }
        } catch {
            dispatch({ error: 'Failed to confirm 2FA setup.' });
        } finally {
            dispatch({ isProcessing: false });
        }
    };

    const handleDisable = async () => {
        if (!disablePassword || !disableCode.trim()) return;
        dispatch({ error: '', isProcessing: true });
        try {
            const data = await authedFetcher<ApiTotpDisableResp>('/auth/totp/disable', {
                method: 'POST',
                body: { password: disablePassword, code: disableCode.trim() },
            });
            if ('error' in data) {
                dispatch({ error: data.error });
            } else {
                setAuthData((prev) =>
                    prev
                        ? {
                              ...prev,
                              totpEnabled: false,
                          }
                        : prev,
                );
                dispatch({
                    step: 'status',
                    disablePassword: '',
                    disableCode: '',
                    error: '',
                });
                txToast.success('Two-factor authentication disabled.');
            }
        } catch {
            dispatch({ error: 'Failed to disable 2FA.' });
        } finally {
            dispatch({ isProcessing: false });
        }
    };

    const handleCopyBackupCodes = () => {
        navigator.clipboard.writeText(backupCodes.join('\n'));
        txToast.success('Backup codes copied to clipboard.');
    };

    if (!authData) return null;

    return (
        <TabsContent value="security" tabIndex={undefined}>
            {step === 'status' && (
                <TwoFactorStatusStep
                    enabled={is2faEnabled}
                    error={error}
                    isProcessing={isProcessing}
                    onStartSetup={handleStartSetup}
                    onStartDisable={() => dispatch({ step: 'disable' })}
                />
            )}

            {step === 'setup' && (
                <TwoFactorSetupStep
                    setupSecret={setupSecret}
                    qrDataUrl={qrDataUrl}
                    verifyCode={verifyCode}
                    error={error}
                    isProcessing={isProcessing}
                    onCodeChange={(verifyCode) => dispatch({ verifyCode, error: '' })}
                    onCancel={() => dispatch({ step: 'status', error: '' })}
                    onConfirm={handleConfirmSetup}
                />
            )}

            {step === 'backup' && (
                <TwoFactorBackupStep
                    backupCodes={backupCodes}
                    onCopy={handleCopyBackupCodes}
                    onFinish={() => {
                        dispatch({
                            step: 'status',
                            backupCodes: [],
                            verifyCode: '',
                            setupSecret: '',
                            qrDataUrl: '',
                        });
                    }}
                />
            )}

            {step === 'disable' && (
                <TwoFactorDisableStep
                    disablePassword={disablePassword}
                    disableCode={disableCode}
                    error={error}
                    isProcessing={isProcessing}
                    onPasswordChange={(disablePassword) => dispatch({ disablePassword, error: '' })}
                    onCodeChange={(disableCode) => dispatch({ disableCode, error: '' })}
                    onCancel={() => {
                        dispatch({
                            step: 'status',
                            error: '',
                            disablePassword: '',
                            disableCode: '',
                        });
                    }}
                    onDisable={handleDisable}
                />
            )}
        </TabsContent>
    );
}

/**
 * Account Dialog
 */
export default function AccountDialog() {
    const { authData } = useAuth();
    const { hasPerm } = useAdminPerms();
    const { isAccountModalOpen, setAccountModalOpen, accountModalTab, setAccountModalTab } = useAccountModal();

    useEffect(() => {
        if (!authData) return;
        if (authData.isTempPassword) {
            setAccountModalOpen(true);
            setAccountModalTab('password');
        }
    }, []);

    const dialogSetIsClose = (newState: boolean) => {
        if (!newState && authData && !authData.isTempPassword) {
            setAccountModalOpen(false);
            setTimeout(() => {
                setAccountModalTab('password');
            }, 500);
        }
    };

    if (!authData) return;
    const canEditIdentifiers = window.txConsts.allowSelfIdentifierEdit || hasPerm('manage.admins');
    return (
        <Dialog open={isAccountModalOpen} onOpenChange={dialogSetIsClose}>
            <DialogContent className="sm:max-w-lg" tabIndex={undefined}>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">
                        {authData.isTempPassword ? 'Welcome to fxPanel!' : `Your Account - ${authData.name}`}
                    </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="password" value={accountModalTab} onValueChange={setAccountModalTab}>
                    <TabsList className={`mb-4 grid w-full ${canEditIdentifiers ? 'grid-cols-3' : 'grid-cols-2'}`}>
                        <TabsTrigger value="password">Password</TabsTrigger>
                        {canEditIdentifiers && (
                            <TabsTrigger value="identifiers" disabled={authData.isTempPassword}>
                                Identifiers
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="security" disabled={authData.isTempPassword}>
                            Security
                        </TabsTrigger>
                    </TabsList>
                    <ChangePasswordTab />
                    {canEditIdentifiers && <ChangeIdentifiersTab />}
                    <TwoFactorTab />
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
