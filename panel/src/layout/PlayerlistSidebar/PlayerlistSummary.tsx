import { playerCountAtom } from '@/hooks/playerlist';
import { useAtomValue } from 'jotai';
import { UsersIcon } from 'lucide-react';

export default function PlayerlistSummary() {
    const playerCount = useAtomValue(playerCountAtom);
    const playerCountFormatted = playerCount.toLocaleString('en-US');

    return (
        <div className="flex w-full items-center justify-between">
            <div className="flex size-16 items-center justify-center rounded-full bg-zinc-600/50">
                <UsersIcon className="text-opacity-80 size-10 stroke-1 text-zinc-400" />
            </div>
            <div className="flex flex-col items-end">
                <div className="font-mono text-4xl font-extralight">{playerCountFormatted}</div>
                <div className="text-lg font-light tracking-wider opacity-80">Players</div>
            </div>
        </div>
    );
}
