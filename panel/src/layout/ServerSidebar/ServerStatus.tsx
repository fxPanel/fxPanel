import { useGlobalStatus } from '@/hooks/status';
import { VariantProps, cva } from 'class-variance-authority';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DiscordBotStatus, FxMonitorHealth } from '@shared/enums';
import { msToShortDuration } from '@/lib/dateTime';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
    `rounded-sm text-xs font-semibold px-1 py-0.5 tracking-widest text-center cursor-help`,
    {
        variants: {
            type: {
                default: 'bg-secondary text-secondary-foreground',
                destructive: 'bg-destructive text-destructive-foreground',
                warning: 'bg-warning text-warning-foreground',
                success: 'bg-success text-success-foreground',
                info: 'bg-info text-info-foreground',
                muted: 'bg-muted text-muted-foreground',
            },
        },
        defaultVariants: {
            type: 'default',
        },
    },
);
type StatusBadgeTypesVars = VariantProps<typeof statusBadgeVariants>['type'];
type StatusBadgeProps = {
    tooltip?:
        | string
        | {
              title: string;
              description: string;
          };
    type?: StatusBadgeTypesVars;
    children: React.ReactNode;
};

function StatusBadge({ children, tooltip, type }: StatusBadgeProps) {
    //If no tooltip is provided, just show the text
    if (!tooltip) {
        return <span className={statusBadgeVariants({ type })}>{children}</span>;
    }

    return (
        <Tooltip>
            <TooltipTrigger type="button" className={statusBadgeVariants({ type })}>
                {children}
            </TooltipTrigger>
            <TooltipContent side="right">
                {typeof tooltip === 'string' ? (
                    <p>{tooltip}</p>
                ) : (
                    <>
                        <h3>{tooltip.title}</h3>
                        <p
                            className={cn(
                                'text-muted-foreground text-xs tracking-wider whitespace-pre-wrap',
                                type === 'warning' && 'text-warning-inline',
                            )}
                        >
                            {tooltip.description}
                        </p>
                    </>
                )}
            </TooltipContent>
        </Tooltip>
    );
}

const discordStatusMap = {
    [DiscordBotStatus.Disabled]: {
        text: 'DISABLED',
        color: 'default',
        description: 'Discord bot is disabled.',
    },
    [DiscordBotStatus.Starting]: {
        text: 'STARTING',
        color: 'warning',
        description: 'Discord bot is starting.',
    },
    [DiscordBotStatus.Ready]: {
        text: 'READY',
        color: 'default',
        description: 'Discord bot is ready.',
    },
    [DiscordBotStatus.Error]: {
        text: 'ERROR',
        color: 'destructive',
        description: 'Discord bot is in an error state.',
    },
} as const;

export default function ServerStatus() {
    const globalStatus = useGlobalStatus();

    //Preparing status
    let serverHealthText = '--';
    let serverHealthDescTitle = '--';
    let serverHealthDescInfo = '--';
    let serverHealthColor: StatusBadgeTypesVars = 'default';
    let serverUptimeText = '--';
    let serverUptimeDesc = '--';
    let whitelistText = '--';
    let whitelistDesc = '--';
    let whitelistColor: StatusBadgeTypesVars = 'default';
    let discordStatusText = '--';
    let discordStatusDesc = '--';
    let discordStatusColor: StatusBadgeTypesVars = 'default';
    let restartText = '--';
    let restartDesc = 'No restart scheduled.';
    let restartColor: StatusBadgeTypesVars = 'default';

    if (globalStatus) {
        //Server uptime
        if (globalStatus.server.uptime > 0) {
            serverUptimeText = msToShortDuration(globalStatus.server.uptime, {
                units: ['d', 'h', 'm'],
                delimiter: ' ',
            });
            serverUptimeDesc = 'Time since the server came online.';
        }

        //Server status
        serverHealthText = globalStatus.server.health;
        serverHealthDescInfo = globalStatus.server.healthReason;
        if (globalStatus.server.health === FxMonitorHealth.ONLINE) {
            serverHealthColor = 'success';
            serverHealthDescTitle = 'Resources running, accepting connections.';
        } else if (globalStatus.server.health === FxMonitorHealth.PARTIAL) {
            serverHealthColor = 'warning';
            serverHealthDescTitle = 'Resources not running or not accepting connections.';
        } else if (globalStatus.server.health === FxMonitorHealth.OFFLINE) {
            serverHealthColor = 'destructive';
            serverHealthDescTitle = 'Server is offline.';
        } else {
            serverHealthColor = 'destructive';
            serverHealthDescTitle = 'Unknown server status.';
        }

        //Whitelist
        if (globalStatus.server.whitelist === 'disabled') {
            whitelistText = 'DISABLED';
            whitelistDesc = 'Anyone can join.';
        } else if (globalStatus.server.whitelist === 'adminOnly') {
            whitelistText = 'ADMIN';
            whitelistColor = 'warning';
            whitelistDesc = 'Only admins can join.';
        } else if (globalStatus.server.whitelist === 'discordMember') {
            whitelistText = 'MEMBER';
            whitelistDesc = 'Only Discord server members can join.';
        } else if (globalStatus.server.whitelist === 'discordRoles') {
            whitelistText = 'ROLES';
            whitelistDesc = 'Only Discord server members with the specified roles can join.';
        } else if (globalStatus.server.whitelist === 'approvedLicense') {
            whitelistText = 'LICENSE';
            whitelistDesc = 'Only players with an approved license can join.';
        }

        //Bot status - too long to show all the text, so just show the code
        if (globalStatus.discord in discordStatusMap) {
            discordStatusText = discordStatusMap[globalStatus.discord].text;
            discordStatusColor = discordStatusMap[globalStatus.discord].color;
            discordStatusDesc = discordStatusMap[globalStatus.discord].description;
        } else {
            discordStatusText = `CODE-${globalStatus.discord}`;
            discordStatusColor = 'destructive';
            discordStatusDesc = 'Unknown status code';
        }

        //Restart schedule
        if (globalStatus.scheduler.nextRelativeMs !== false) {
            const timeStr = msToShortDuration(globalStatus.scheduler.nextRelativeMs, {
                units: ['h', 'm'],
                delimiter: ' ',
            });
            if (globalStatus.scheduler.nextSkip) {
                restartText = timeStr;
                restartColor = 'info';
                restartDesc = 'Next restart is set to be skipped.';
            } else if (globalStatus.scheduler.nextIsTemp) {
                restartText = timeStr;
                restartColor = 'info';
                restartDesc = 'Temporary restart scheduled.';
            } else if (globalStatus.scheduler.nextRelativeMs <= 10 * 60 * 1000) {
                restartText = timeStr;
                restartColor = 'warning';
                restartDesc = 'Server restart is coming soon.';
            } else {
                restartText = timeStr;
                restartDesc = 'Time until next scheduled restart.';
            }
        } else {
            restartText = 'NONE';
            restartColor = 'muted';
            restartDesc = 'No restart scheduled.';
        }
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="text-muted-foreground flex items-center justify-between gap-1.5 text-sm">
                Server:
                <StatusBadge
                    tooltip={{
                        title: serverHealthDescTitle,
                        description: serverHealthDescInfo,
                    }}
                    type={serverHealthColor}
                >
                    {serverHealthText}
                </StatusBadge>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-1.5 text-sm">
                Uptime:
                <StatusBadge tooltip={serverUptimeDesc}>{serverUptimeText}</StatusBadge>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-1.5 text-sm">
                Whitelist:
                <StatusBadge tooltip={whitelistDesc} type={whitelistColor}>
                    {whitelistText}
                </StatusBadge>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-1.5 text-sm">
                Discord Bot:
                <StatusBadge tooltip={discordStatusDesc} type={discordStatusColor}>
                    {discordStatusText}
                </StatusBadge>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-1.5 text-sm">
                Next Restart:
                <StatusBadge tooltip={restartDesc} type={restartColor}>
                    {restartText}
                </StatusBadge>
            </div>
        </div>
    );
}
