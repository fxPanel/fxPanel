import { cn } from '@/lib/utils';
import { PlusIcon } from 'lucide-react';

type BanTemplatesListAddButtonProps = {
    onClick: () => void;
    disabled: boolean;
};

export default function BanTemplatesListAddButton({ onClick, disabled }: BanTemplatesListAddButtonProps) {
    return (
        <li>
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className={cn(
                    'bg-card flex w-full gap-3 rounded-lg border px-2 py-3 text-left',
                    disabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:bg-primary hover:text-primary-foreground cursor-pointer',
                )}
            >
                <PlusIcon className="size-6" />
                <span>Add New Reason</span>
            </button>
        </li>
    );
}
