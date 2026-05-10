//NOTE: this is not part of the original shadcn/ui
// ref: https://shadcnui-expansions.typeart.cc/docs/autosize-textarea

'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { useImperativeHandle } from 'react';

interface UseAutosizeTextAreaProps {
    textAreaRef: HTMLTextAreaElement | null;
    minHeight?: number;
    maxHeight?: number;
    triggerAutoSize: string;
}

const useAutosizeTextArea = ({
    textAreaRef,
    triggerAutoSize,
    maxHeight = Number.MAX_SAFE_INTEGER,
    minHeight = 0,
}: UseAutosizeTextAreaProps) => {
    const [init, setInit] = React.useState(true);
    React.useEffect(() => {
        // We need to reset the height momentarily to get the correct scrollHeight for the textarea
        const offsetBorder = 2;
        if (textAreaRef) {
            if (init) {
                textAreaRef.style.minHeight = `${minHeight + offsetBorder}px`;
                if (maxHeight > minHeight) {
                    textAreaRef.style.maxHeight = `${maxHeight}px`;
                }
                setInit(false);
            }
            textAreaRef.style.height = `${minHeight + offsetBorder}px`;
            const scrollHeight = textAreaRef.scrollHeight;
            // We then set the height directly, outside of the render loop
            // Trying to set this with state or a ref will product an incorrect value.
            if (scrollHeight > maxHeight) {
                textAreaRef.style.height = `${maxHeight}px`;
            } else {
                textAreaRef.style.height = `${scrollHeight + offsetBorder}px`;
            }
        }
    }, [textAreaRef, triggerAutoSize]);
};

export type AutosizeTextAreaRef = {
    textArea: HTMLTextAreaElement;
    maxHeight: number;
    minHeight: number;
};

type AutosizeTextAreaProps = {
    maxHeight?: number;
    minHeight?: number;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

type AutosizeTextareaComponentProps = AutosizeTextAreaProps & {
    ref?: React.Ref<AutosizeTextAreaRef>;
};

export const AutosizeTextarea = ({
    maxHeight = Number.MAX_SAFE_INTEGER,
    minHeight = 52,
    className,
    onChange,
    value,
    ref,
    ...props
}: AutosizeTextareaComponentProps) => {
    const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const [autoSizeRevision, bumpAutoSizeRevision] = React.useReducer((revision) => revision + 1, 0);
    const triggerAutoSize = `${String(value ?? props.defaultValue ?? props.placeholder ?? '')}:${autoSizeRevision}`;

    useAutosizeTextArea({
        textAreaRef: textAreaRef.current,
        triggerAutoSize: triggerAutoSize,
        maxHeight,
        minHeight,
    });

    useImperativeHandle(ref, () => ({
        textArea: textAreaRef.current as HTMLTextAreaElement,
        maxHeight,
        minHeight,
    }));

    return (
        <textarea
            {...props}
            value={value}
            ref={textAreaRef}
            className={cn(
                'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
                'bg-black/30 placeholder:opacity-50', //TX CUSTOM
                //NOTE: check if already available:
                // https://developer.mozilla.org/en-US/docs/Web/CSS/field-sizing
                // https://tailwindcss.com/docs/v4-beta#field-sizing-utilities
                className,
            )}
            onChange={(e) => {
                bumpAutoSizeRevision();
                onChange?.(e);
            }}
        />
    );
};
AutosizeTextarea.displayName = 'AutosizeTextarea';
