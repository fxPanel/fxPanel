import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GenericApiOkResp } from '@shared/genericApiTypes';
import type { ApiChangeBanDurationReqSchema } from '@shared/historyApiSchemas';
import { useAdminPerms } from '@/hooks/auth';
import { Loader2Icon } from 'lucide-react';
import { useBackendApi } from '@/hooks/fetch';

type DatabaseActionBanType = {
    id: string;
    revocation?: unknown;
};

type ActionEditTabProps = {
    action: DatabaseActionBanType;
    refreshModalData: () => void;
};

export default function ActionEditTab({ action, refreshModalData }: ActionEditTabProps) {
    const [isChangingDuration, setIsChangingDuration] = useState(false);
    const [currentDuration, setCurrentDuration] = useState('2 days');
    const [customUnits, setCustomUnits] = useState('days');
    const customMultiplierRef = useRef<HTMLInputElement>(null);
    const { hasPerm } = useAdminPerms();

    const changeDurationApi = useBackendApi<GenericApiOkResp, ApiChangeBanDurationReqSchema>({
        method: 'POST',
        path: `/history/changeBanDuration`,
    });

    const doChangeDuration = () => {
        const duration =
            currentDuration === 'custom'
                ? `${customMultiplierRef.current?.value ?? '1'} ${customUnits}`
                : currentDuration;
        setIsChangingDuration(true);
        changeDurationApi({
            data: { actionId: action.id, duration },
            toastLoadingMessage: 'Changing ban duration…',
            genericHandler: {
                successMsg: 'Ban duration changed.',
            },
            success: (data) => {
                setIsChangingDuration(false);
                if ('success' in data) {
                    refreshModalData();
                }
            },
        });
    };

    const hasBanPerm = hasPerm('players.ban');
    const isRevoked = !!action.revocation;

    return (
        <div className="mb-1 flex flex-col gap-4 px-1 md:mb-4">
            <div className="space-y-2">
                <h3 className="text-xl">Change Duration</h3>
                <p className="text-muted-foreground text-sm">
                    Set a new duration for this ban. The expiration will be recalculated from now.
                </p>
                {isRevoked ? (
                    <p className="text-warning-inline text-sm">
                        This ban has been revoked. The duration cannot be changed.
                    </p>
                ) : (
                    <>
                        <div className="space-y-1">
                            <Label htmlFor="durationSelect" className="sr-only">
                                Duration
                            </Label>
                            <Select
                                onValueChange={setCurrentDuration}
                                value={currentDuration}
                                disabled={isChangingDuration}
                            >
                                <SelectTrigger id="durationSelect" className="tracking-wide">
                                    <SelectValue placeholder="Select Duration" />
                                </SelectTrigger>
                                <SelectContent className="tracking-wide">
                                    <SelectItem value="custom" className="font-bold">
                                        Custom (set below)
                                    </SelectItem>
                                    <SelectItem value="2 hours">2 HOURS</SelectItem>
                                    <SelectItem value="8 hours">8 HOURS</SelectItem>
                                    <SelectItem value="1 day">1 DAY</SelectItem>
                                    <SelectItem value="2 days">2 DAYS</SelectItem>
                                    <SelectItem value="1 week">1 WEEK</SelectItem>
                                    <SelectItem value="2 weeks">2 WEEKS</SelectItem>
                                    <SelectItem value="permanent" className="font-bold">
                                        Permanent
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="flex flex-row gap-2">
                                <Input
                                    type="number"
                                    placeholder="123"
                                    min={1}
                                    max={99}
                                    disabled={currentDuration !== 'custom' || isChangingDuration}
                                    ref={customMultiplierRef}
                                />
                                <Select onValueChange={setCustomUnits} value={customUnits}>
                                    <SelectTrigger
                                        className="tracking-wide"
                                        disabled={currentDuration !== 'custom' || isChangingDuration}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="tracking-wide">
                                        <SelectItem value="hours">HOURS</SelectItem>
                                        <SelectItem value="days">DAYS</SelectItem>
                                        <SelectItem value="weeks">WEEKS</SelectItem>
                                        <SelectItem value="months">MONTHS</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button
                            variant="default"
                            size="xs"
                            disabled={!hasBanPerm || isChangingDuration}
                            onClick={doChangeDuration}
                        >
                            {isChangingDuration ? (
                                <span className="flex items-center leading-relaxed">
                                    <Loader2Icon className="inline h-4 animate-spin" /> Changing…
                                </span>
                            ) : hasBanPerm ? (
                                'Change Duration'
                            ) : (
                                'Change Duration (no permission)'
                            )}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
