import { PlayerModalPlayerData } from '@shared/playerApiTypes';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

type DayData = {
    date: string; //YYYY-MM-DD
    hours: number[]; //24 slots, minutes per hour
    total: number;
};

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getIntensityClass = (minutes: number) => {
    if (minutes === 0) return 'bg-secondary/40';
    if (minutes <= 15) return 'bg-emerald-900/60';
    if (minutes <= 30) return 'bg-emerald-700/70';
    if (minutes <= 45) return 'bg-emerald-500/80';
    return 'bg-emerald-400';
};

const getDayIntensityClass = (minutes: number) => {
    if (minutes === 0) return 'bg-secondary/40';
    if (minutes <= 30) return 'bg-emerald-900/60';
    if (minutes <= 120) return 'bg-emerald-700/70';
    if (minutes <= 300) return 'bg-emerald-500/80';
    return 'bg-emerald-400';
};

type PlayerActivityTabProps = {
    player: PlayerModalPlayerData;
    serverTime: number;
};

export default function PlayerActivityTab({ player, serverTime }: PlayerActivityTabProps) {
    const { dayGrid, peakHours, activeDays, avgDailyMinutes } = useMemo(() => {
        const history = player.sessionHistory ?? [];
        if (!history.length) {
            return { dayGrid: [], peakHours: [], activeDays: 0, avgDailyMinutes: 0 };
        }

        //Build hourly map from session history (UTC keys)
        const utcHourlyMap = new Map<string, number>();
        for (const [key, mins] of history) {
            const [datePart, hourPart] = key.split('T');
            const normalizedKey = hourPart ? key : `${datePart}T12`;
            utcHourlyMap.set(normalizedKey, (utcHourlyMap.get(normalizedKey) ?? 0) + mins);
        }

        //Re-key UTC hours to local (system) time
        const hourlyMap = new Map<string, number>();
        for (const [key, mins] of utcHourlyMap) {
            const [datePart, hourPart] = key.split('T');
            if (!hourPart) continue;
            const [y, m, d] = datePart.split('-').map(Number);
            const utcDate = new Date(Date.UTC(y, m - 1, d, parseInt(hourPart, 10)));
            const localKey = `${utcDate.getFullYear()}-${String(utcDate.getMonth() + 1).padStart(2, '0')}-${String(utcDate.getDate()).padStart(2, '0')}T${String(utcDate.getHours()).padStart(2, '0')}`;
            hourlyMap.set(localKey, (hourlyMap.get(localKey) ?? 0) + mins);
        }

        //Build last 28 days grid using local time
        const days: DayData[] = [];
        const now = new Date(serverTime * 1000);
        for (let d = 27; d >= 0; d--) {
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const hours = new Array(24).fill(0);
            let total = 0;
            for (let h = 0; h < 24; h++) {
                const hourKey = `${dateStr}T${String(h).padStart(2, '0')}`;
                const mins = hourlyMap.get(hourKey) ?? 0;
                hours[h] = mins;
                total += mins;
            }
            days.push({ date: dateStr, hours, total });
        }

        //Peak hours (aggregate all 120 days of data)
        const hourTotals = new Array(24).fill(0);
        const hourDayCounts = new Array(24).fill(0);
        for (const [key, mins] of hourlyMap) {
            const [, hourPart] = key.split('T');
            if (!hourPart) continue;
            const hour = parseInt(hourPart, 10);
            if (!isNaN(hour)) {
                hourTotals[hour] += mins;
                hourDayCounts[hour]++;
            }
        }

        //Find top 3 peak hours by total minutes
        const peakHoursList = hourTotals
            .reduce<{ hour: number; total: number; avgMins: number }[]>((hours, total, hour) => {
                if (total > 0) {
                    hours.push({
                        hour,
                        total,
                        avgMins: hourDayCounts[hour] ? Math.round(total / hourDayCounts[hour]) : 0,
                    });
                }

                return hours;
            }, [])
            .sort((a, b) => b.total - a.total)
            .slice(0, 3);

        //Activity stats
        const daysWithActivity = days.filter((d) => d.total > 0).length;
        const totalMinsLast28 = days.reduce((sum, d) => sum + d.total, 0);
        const avgDaily = daysWithActivity > 0 ? Math.round(totalMinsLast28 / 28) : 0;

        return {
            dayGrid: days,
            peakHours: peakHoursList,
            activeDays: daysWithActivity,
            avgDailyMinutes: avgDaily,
        };
    }, [player.sessionHistory, serverTime]);

    const firstDayPadding = useMemo(() => {
        if (!dayGrid.length) return [] as string[];

        const firstDow = new Date(`${dayGrid[0].date}T00:00:00Z`).getUTCDay();
        return Array.from({ length: firstDow }, (_, dayOffset) => `pad-${dayOffset}`);
    }, [dayGrid]);

    if (!player.sessionHistory?.length) {
        return (
            <div className="flex h-full items-center justify-center p-4">
                <span className="text-muted-foreground text-sm">No activity data available.</span>
            </div>
        );
    }

    const formatHour = (h: number) => {
        const suffix = h >= 12 ? 'PM' : 'AM';
        const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${display}${suffix}`;
    };

    const formatMinutes = (mins: number) => {
        if (mins < 60) return `${mins}m`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    return (
        <div className="space-y-4 p-1">
            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary/30 rounded-md p-2 text-center">
                    <div className="text-lg font-semibold">{activeDays}/28</div>
                    <div className="text-muted-foreground text-xs">Active Days</div>
                </div>
                <div className="bg-secondary/30 rounded-md p-2 text-center">
                    <div className="text-lg font-semibold">{formatMinutes(avgDailyMinutes)}</div>
                    <div className="text-muted-foreground text-xs">Avg / Day</div>
                </div>
                <div className="bg-secondary/30 rounded-md p-2 text-center">
                    <div className="text-lg font-semibold">
                        {peakHours.length > 0 ? formatHour(peakHours[0].hour) : '--'}
                    </div>
                    <div className="text-muted-foreground text-xs">Peak Hour</div>
                </div>
            </div>

            {/* Typical hours */}
            {peakHours.length > 0 && (
                <div>
                    <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">
                        Most Active Hours
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {peakHours.map(({ hour, total }) => (
                            <span
                                key={hour}
                                className="bg-secondary inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                            >
                                <span className="font-medium">{formatHour(hour)}</span>
                                <span className="text-muted-foreground">({formatMinutes(total)} total)</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Day grid — last 28 days */}
            <div>
                <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">
                    Last 28 Days
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {dayLabels.map((label) => (
                        <div key={label} className="text-muted-foreground text-center text-[10px]">
                            {label}
                        </div>
                    ))}
                    {/* Pad first week to align with day of week */}
                    {firstDayPadding.map((padKey) => (
                        <div key={padKey} />
                    ))}
                    {dayGrid.map((day) => (
                        <div
                            key={day.date}
                            className={cn(
                                'aspect-square rounded-sm transition-colors',
                                getDayIntensityClass(day.total),
                            )}
                            title={`${day.date}: ${formatMinutes(day.total)}`}
                        />
                    ))}
                </div>
                <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px]">
                    <span className="text-muted-foreground">Less</span>
                    <div className={cn('size-2.5 rounded-sm', 'bg-secondary/40')} />
                    <div className={cn('size-2.5 rounded-sm', 'bg-emerald-900/60')} />
                    <div className={cn('size-2.5 rounded-sm', 'bg-emerald-700/70')} />
                    <div className={cn('size-2.5 rounded-sm', 'bg-emerald-500/80')} />
                    <div className={cn('size-2.5 rounded-sm', 'bg-emerald-400')} />
                    <span className="text-muted-foreground">More</span>
                </div>
            </div>

            {/* Hourly breakdown for today */}
            {dayGrid.length > 0 && dayGrid.at(-1)!.total > 0 && (
                <div>
                    <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wider uppercase">
                        Today&apos;s Hourly Breakdown
                    </div>
                    <div className="grid grid-cols-12 gap-0.5">
                        {Array.from(dayGrid.at(-1)!.hours.entries()).map(([hour, mins]) => (
                            <div
                                key={`hour-${hour}`}
                                className={cn('flex flex-col items-center rounded-sm py-0.5', getIntensityClass(mins))}
                                title={`${formatHour(hour)}: ${mins}m`}
                            >
                                <span className="text-[8px] leading-none opacity-70">{String(hour).padStart(2, '0')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
