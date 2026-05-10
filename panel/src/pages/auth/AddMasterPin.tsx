import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ApiAddMasterPinReq, ApiAddMasterPinResp } from '@shared/authApiTypes';
import { useEffect, useReducer } from 'react';
import { Loader2 } from 'lucide-react';
import { LogoutReasonHash } from './Login';
import { fetchWithTimeout } from '@/hooks/fetch';
import { AuthError, processFetchError, type AuthErrorData } from './errors';

type AddMasterPinState = {
    pin: string;
    isRedirecting: boolean;
    messageText: string | undefined;
    isMessageError: boolean;
    isFetching: boolean;
    fullPageError: AuthErrorData | undefined;
};

function reduceAddMasterPinState(state: AddMasterPinState, action: Partial<AddMasterPinState>): AddMasterPinState {
    return {
        ...state,
        ...action,
    };
}

const getSafeRedirectPath = (value: string) => {
    try {
        const parsed = new URL(value, window.location.origin);
        if (parsed.origin !== window.location.origin) return null;
        if (!parsed.pathname.startsWith('/')) return null;
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return null;
    }
};

export default function AddMasterPin() {
    const [state, dispatch] = useReducer(reduceAddMasterPinState, {
        pin: '',
        isRedirecting: false,
        messageText: undefined,
        isMessageError: false,
        isFetching: false,
        fullPageError: undefined,
    });
    const { pin, isRedirecting, messageText, isMessageError, isFetching, fullPageError } = state;

    const submitPin = async (pinOverride?: string) => {
        try {
            dispatch({
                isMessageError: false,
                messageText: undefined,
                isFetching: true,
            });
            const data = await fetchWithTimeout<ApiAddMasterPinResp, ApiAddMasterPinReq>(`/auth/addMaster/pin`, {
                method: 'POST',
                body: {
                    pin: (pinOverride ?? pin) || '000000',
                    origin: window.location.origin,
                },
            });
            if ('error' in data) {
                if (data.error === 'master_already_set') {
                    dispatch({
                        isRedirecting: true,
                        fullPageError: { errorCode: data.error },
                    });
                } else {
                    dispatch({ isMessageError: true, messageText: data.error });
                }
            } else {
                dispatch({ isRedirecting: true });
                const safeRedirectPath = getSafeRedirectPath(data.authUrl);
                if (!safeRedirectPath) {
                    dispatch({
                        isRedirecting: false,
                        isMessageError: true,
                        messageText: 'Invalid redirect URL.',
                    });
                    return;
                }
                console.log('Redirecting to', safeRedirectPath);
                window.location.assign(safeRedirectPath);
            }
        } catch (error) {
            const { errorTitle, errorMessage } = processFetchError(error);
            dispatch({
                isMessageError: true,
                messageText: `${errorTitle}: ${errorMessage}`,
            });
        } finally {
            dispatch({ isFetching: false });
        }
    };

    const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
        event?.preventDefault();
        submitPin();
    };

    useEffect(() => {
        if (/^#\d{6}$/.test(window.location.hash)) {
            dispatch({
                messageText: 'Auto-filled ✔',
                pin: window.location.hash.substring(1),
            });
        }
    }, []);

    if (fullPageError) {
        return <AuthError error={fullPageError} />;
    }

    const disableInput = isFetching || isRedirecting;
    return (
        <form onSubmit={handleSubmit} className="w-full">
            <CardHeader className="space-y-1">
                <CardTitle className="text-3xl">No Cfx.re account linked</CardTitle>
                <CardDescription className="text-muted-foreground text-base">
                    Type in the PIN from the terminal.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
                <span className={cn('text-center', isMessageError ? 'text-destructive' : 'text-success')}>
                    {messageText ?? <>&nbsp;</>}
                </span>
                <Input
                    className={cn(
                        'p-2 text-center font-mono text-2xl tracking-[0.25em]',
                        messageText &&
                            (isMessageError
                                ? 'border-acctext-destructive text-destructive'
                                : 'border-succtext-success text-success'),
                    )}
                    id="frm-pin"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    minLength={6}
                    maxLength={6}
                    placeholder="000000"
                    autoComplete="off"
                    value={pin}
                    onFocus={(e) => {
                        dispatch({ isMessageError: false, messageText: undefined });
                        e.target?.select();
                    }}
                    onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, '');
                        dispatch({ pin: digitsOnly });
                        if (digitsOnly.length === 6) {
                            submitPin(digitsOnly);
                        }
                    }}
                    disabled={disableInput}
                    required
                />
            </CardContent>
            <CardFooter>
                <Button className="w-full" disabled={disableInput}>
                    {disableInput && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Link Account
                </Button>
            </CardFooter>
        </form>
    );
}
