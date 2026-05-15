import { useMemo } from 'react';
import { AlertTriangleIcon, ClockIcon, ExternalLinkIcon, ShieldAlertIcon, UserIcon } from 'lucide-react';
import { ClientDateText } from '@/components/ClientDateText';
import { cn, createDuplicateKeyResolver } from '@/lib/utils';
import { PlayerModalPlayerData } from '@shared/playerApiTypes';

/**
 * Extracts the creation timestamp from a Discord snowflake ID.
 * Discord epoch is 1420070400000 (2015-01-01T00:00:00.000Z).
 */
const getDiscordAccountAge = (ids: string[]) => {
    const discordId = ids.find((id) => id.startsWith('discord:'));
    if (!discordId) return null;
    const snowflake = discordId.split(':')[1];
    const timestamp = Number(BigInt(snowflake) >> 22n) + 1420070400000;
    if (isNaN(timestamp) || timestamp < 1420070400000) return null;
    return new Date(timestamp);
};

/**
 * Converts a FiveM steam hex identifier to a Steam profile URL.
 * Format: steam:1100001XXXXXXXX (hex) -> Steam64 decimal ID
 */
const getSteamProfileUrl = (ids: string[]) => {
    const steamId = ids.find((id) => id.startsWith('steam:'));
    if (!steamId) return null;
    const hexValue = steamId.split(':')[1];
    const steam64 = BigInt(`0x${hexValue}`).toString();
    return `https://steamcommunity.com/profiles/${steam64}`;
};

/**
 * Formats a duration between two dates as a human-readable string.
 */
const formatAge = (from: Date, to: Date = new Date()) => {
    const diffMs = to.getTime() - from.getTime();
    if (diffMs < 0) return 'Unknown';
    const days = Math.floor(diffMs / 86_400_000);
    if (days < 1) return 'Less than a day';
    if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
    const years = Math.floor(months / 12);
    const remMonths = months % 12;
    if (remMonths === 0) return `${years} year${years !== 1 ? 's' : ''}`;
    return `${years}y ${remMonths}mo`;
};

/**
 * Detects identifiers that were previously used but are no longer present.
 * oldIds contains ALL historic ids (including current), ids contains current session ids.
 */
const detectIdChanges = (currentIds: string[], allIds?: string[]) => {
    if (!allIds || !allIds.length) return [];
    const currentSet = new Set(currentIds);
    const changes: { type: string; oldId: string }[] = [];
    const trackableTypes = new Set(['discord', 'steam', 'live', 'xbl', 'fivem']);
    for (const id of allIds) {
        if (currentSet.has(id)) continue;
        const [type] = id.split(':');
        if (!trackableTypes.has(type)) continue;
        //Only flag if the player has a current id of the same type
        //i.e. they swapped their discord, not just didn't have one before
        const hasCurrentOfType = currentIds.some((cid) => cid.startsWith(`${type}:`));
        if (hasCurrentOfType) {
            changes.push({ type, oldId: id });
        }
    }
    return changes;
};

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type RiskFactor = {
    level: RiskLevel;
    score: number;
    reasons: string[];
};

/**
 * Computes a risk factor based on action history and account signals.
 */
const computeRiskFactor = (
    player: PlayerModalPlayerData,
    idChanges: { type: string; oldId: string }[],
    discordAge: Date | null,
): RiskFactor => {
    let score = 0;
    const reasons: string[] = [];
    const history = player.actionHistory;

    //Count active (non-revoked) actions
    const activeBans = history.filter((a) => a.type === 'ban' && !a.revokedAt).length;
    const activeWarns = history.filter((a) => a.type === 'warn' && !a.revokedAt).length;
    const kicks = history.filter((a) => a.type === 'kick').length;

    //Count total (including revoked)
    const totalBans = history.filter((a) => a.type === 'ban').length;
    const totalWarns = history.filter((a) => a.type === 'warn').length;

    if (activeBans > 0) {
        score += activeBans * 30;
        reasons.push(`${activeBans} active ban${activeBans !== 1 ? 's' : ''}`);
    }
    if (totalBans > activeBans) {
        const revokedBans = totalBans - activeBans;
        score += revokedBans * 10;
        reasons.push(`${revokedBans} past ban${revokedBans !== 1 ? 's' : ''} (revoked)`);
    }
    if (activeWarns > 0) {
        score += activeWarns * 10;
        reasons.push(`${activeWarns} active warning${activeWarns !== 1 ? 's' : ''}`);
    }
    if (totalWarns > activeWarns) {
        const revokedWarns = totalWarns - activeWarns;
        score += revokedWarns * 3;
        reasons.push(`${revokedWarns} past warning${revokedWarns !== 1 ? 's' : ''} (revoked)`);
    }
    if (kicks > 0) {
        score += kicks * 5;
        reasons.push(`${kicks} kick${kicks !== 1 ? 's' : ''}`);
    }

    //Identifier changes as risk signal
    if (idChanges.length > 0) {
        score += idChanges.length * 15;
        reasons.push(`${idChanges.length} identifier change${idChanges.length !== 1 ? 's' : ''}`);
    }

    //New Discord account
    if (discordAge) {
        const ageMs = Date.now() - discordAge.getTime();
        const ageDays = ageMs / 86_400_000;
        if (ageDays < 30) {
            score += 20;
            reasons.push('Discord account < 30 days old');
        } else if (ageDays < 90) {
            score += 10;
            reasons.push('Discord account < 90 days old');
        }
    }

    //Low playtime + actions = suspicious
    if (player.playTime !== undefined && player.playTime < 60 && activeBans + activeWarns > 0) {
        score += 10;
        reasons.push('Low playtime with active sanctions');
    }

    let level: RiskLevel;
    if (score >= 50) level = 'critical';
    else if (score >= 30) level = 'high';
    else if (score >= 15) level = 'medium';
    else level = 'low';

    return { level, score, reasons };
};

const riskColors: Record<RiskLevel, string> = {
    low: 'text-green-500',
    medium: 'text-warning',
    high: 'text-orange-500',
    critical: 'text-destructive',
};
const riskBgColors: Record<RiskLevel, string> = {
    low: 'bg-green-500/10 border-green-500/20',
    medium: 'bg-warning/10 border-warning/20',
    high: 'bg-orange-500/10 border-orange-500/20',
    critical: 'bg-destructive/10 border-destructive/20',
};

type PlayerInsightsTabProps = {
    player: PlayerModalPlayerData;
    serverTime: number;
};

export default function PlayerInsightsTab({ player, serverTime }: PlayerInsightsTabProps) {
    const discordAge = useMemo(() => getDiscordAccountAge(player.ids), [player.ids]);
    const steamProfileUrl = useMemo(() => getSteamProfileUrl(player.ids), [player.ids]);
    const idChanges = useMemo(() => detectIdChanges(player.ids, player.oldIds), [player.ids, player.oldIds]);
    const risk = useMemo(() => computeRiskFactor(player, idChanges, discordAge), [player, idChanges, discordAge]);
    const getRiskReasonKey = createDuplicateKeyResolver();
    const getIdChangeKey = createDuplicateKeyResolver();
    const getNameHistoryKey = createDuplicateKeyResolver();

    if (!player.isRegistered) {
        return (
            <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
                Player is not registered in the database yet.
            </div>
        );
    }

    return (
        <div className="space-y-4 p-1">
            {/* Risk Factor */}
            <div className={cn('rounded-lg border p-3', riskBgColors[risk.level])}>
                <div className="mb-2 flex items-center gap-2">
                    <ShieldAlertIcon className={cn('size-5', riskColors[risk.level])} />
                    <span className="font-medium">Risk Assessment</span>
                    <span className={cn('ml-auto text-sm font-bold uppercase', riskColors[risk.level])}>
                        {risk.level}
                    </span>
                </div>
                {risk.reasons.length > 0 ? (
                    <ul className="text-muted-foreground ml-7 space-y-0.5 text-sm">
                        {risk.reasons.map((reason) => (
                            <li key={getRiskReasonKey(reason)} className="list-disc">
                                {reason}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground ml-7 text-sm">No risk signals detected.</p>
                )}
            </div>

            {/* Account Ages */}
            <div>
                <h4 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <ClockIcon className="size-4" /> Account Ages
                </h4>
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted/50 rounded-md p-2.5 text-sm">
                        <span className="text-muted-foreground">Discord</span>
                        <div className="font-medium">{discordAge ? formatAge(discordAge) : 'N/A'}</div>
                        {discordAge && (
                            <div className="text-muted-foreground text-xs">
                                Created {discordAge.toLocaleDateString()}
                            </div>
                        )}
                    </div>
                    <div className="bg-muted/50 rounded-md p-2.5 text-sm">
                        <span className="text-muted-foreground">Steam</span>
                        <div className="font-medium">
                            {steamProfileUrl ? (
                                <a
                                    href={steamProfileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent inline-flex items-center gap-1 hover:underline"
                                >
                                    Profile <ExternalLinkIcon className="size-3" />
                                </a>
                            ) : (
                                'N/A'
                            )}
                        </div>
                    </div>
                    <div className="bg-muted/50 rounded-md p-2.5 text-sm">
                        <span className="text-muted-foreground">Server</span>
                        <ClientDateText
                            as="div"
                            className="font-medium"
                            timestamp={player.tsJoined ? player.tsJoined * 1000 : null}
                            formatter={formatAge}
                            fallback="N/A"
                        />
                        {player.tsJoined && (
                            <div className="text-muted-foreground text-xs">
                                Joined{' '}
                                <ClientDateText
                                    timestamp={player.tsJoined * 1000}
                                    formatter={(date) => date.toLocaleDateString()}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Identifier Changes */}
            {idChanges.length > 0 && (
                <div>
                    <h4 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-sm font-medium">
                        <AlertTriangleIcon className="text-warning size-4" /> Identifier Changes
                    </h4>
                    <div className="space-y-1">
                        {idChanges.map((change) => (
                            <div
                                key={getIdChangeKey(`${change.type}:${change.oldId}`)}
                                className="bg-warning/5 border-warning/20 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                            >
                                <span className="text-warning font-mono text-xs">{change.type}</span>
                                <span className="text-muted-foreground truncate font-mono text-xs">{change.oldId}</span>
                                <span className="text-warning ml-auto shrink-0 text-xs">changed</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Name History */}
            {player.nameHistory && player.nameHistory.length > 1 && (
                <div>
                    <h4 className="text-muted-foreground mb-2 flex items-center gap-1.5 text-sm font-medium">
                        <UserIcon className="size-4" /> Name History
                        <span className="text-xs">({player.nameHistory.length} names)</span>
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                        {player.nameHistory.map((name, i) => (
                            <span
                                key={getNameHistoryKey(name)}
                                className={cn(
                                    'rounded-md border px-2 py-0.5 text-sm',
                                    i === player.nameHistory!.length - 1
                                        ? 'bg-primary/10 border-primary/30 font-medium'
                                        : 'bg-muted/50 border-muted text-muted-foreground',
                                )}
                            >
                                {name}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
