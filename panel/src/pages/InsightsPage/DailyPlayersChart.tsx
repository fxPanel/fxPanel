import { memo } from 'react';
import { ResponsiveBar, type BarDatum, type BarTooltipProps } from '@nivo/bar';
import { useIsDarkMode } from '@/hooks/theme';
import type { InsightsDailyPlayersDay } from '@shared/insightsApiTypes';

function ChartTooltip({ id, value, data, color }: BarTooltipProps<BarDatum>) {
    return (
        <div className="bg-card text-card-foreground border-border rounded-md border p-2 text-sm shadow-md">
            <div className="font-medium">{data.day as string}</div>
            <div style={{ color }}>
                {id === 'newPlayers' ? 'New' : 'Returning'}: <strong>{value}</strong>
            </div>
        </div>
    );
}

type Props = {
    daily: InsightsDailyPlayersDay[];
};

function DailyPlayersChart({ daily }: Props) {
    const isDarkMode = useIsDarkMode();

    if (!Array.isArray(daily) || !daily.length) {
        return (
            <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                No data available
            </div>
        );
    }

    const data: BarDatum[] = daily.map((d) => ({
        day: d.day.slice(5), // MM-DD
        newPlayers: d.newPlayers,
        returningPlayers: d.returningPlayers,
    }));
    const tickValues =
        data.length > 14
            ? data.reduce<string[]>((values, entry, index) => {
                  if (index % Math.ceil(data.length / 10) === 0) {
                      values.push(entry.day as string);
                  }
                  return values;
              }, [])
            : undefined;

    const colors = isDarkMode ? ['#38bdf8', '#2dd4bf'] : ['#0284c7', '#0f766e'];

    return (
        <div style={{ height: 260 }}>
            <ResponsiveBar
                data={data}
                keys={['newPlayers', 'returningPlayers']}
                indexBy="day"
                margin={{ top: 10, right: 10, bottom: 40, left: 40 }}
                padding={0.3}
                groupMode="stacked"
                colors={colors}
                borderWidth={1}
                borderRadius={4}
                borderColor={{ from: 'color', modifiers: [['darker', 0.55]] }}
                axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: -45,
                    tickValues,
                }}
                axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickValues: 5,
                }}
                enableGridX={false}
                enableGridY={true}
                enableLabel={false}
                theme={{
                    text: {
                        fontSize: 11,
                        fill: isDarkMode ? '#a1a1aa' : '#71717a',
                    },
                    grid: {
                        line: {
                            strokeDasharray: '8 6',
                            stroke: '#3F4146',
                            strokeOpacity: isDarkMode ? 1 : 0.25,
                            strokeWidth: 1,
                        },
                    },
                }}
                tooltip={ChartTooltip}
                legends={[
                    {
                        dataFrom: 'keys',
                        anchor: 'top-right',
                        direction: 'row',
                        translateY: -10,
                        itemWidth: 80,
                        itemHeight: 20,
                        symbolSize: 10,
                        symbolShape: 'circle',
                        itemTextColor: isDarkMode ? '#a1a1aa' : '#71717a',
                    },
                ]}
                animate={true}
                motionConfig="gentle"
            />
        </div>
    );
}

export default memo(DailyPlayersChart);
