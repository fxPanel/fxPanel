import { useEffect, useRef } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { isGlobalMenuSheetOpenAtom, isPlayerlistSheetOpenAtom } from './sheets';

const SWIPE_THRESHOLD = 50; // minimum px to count as a swipe
const EDGE_ZONE = 30; // px from screen edge to trigger edge swipe

/**
 * Hook to handle swipe gestures for opening/closing mobile sidebars.
 * - Swipe right from left edge → open global menu sheet
 * - Swipe left from right edge → open playerlist sheet
 * - Swipe left when global menu is open → close it
 * - Swipe right when right sheet is open → close it
 */
export const useSwipeGestures = () => {
    const setGlobalMenu = useSetAtom(isGlobalMenuSheetOpenAtom);
    const setPlayerlist = useSetAtom(isPlayerlistSheetOpenAtom);
    const isGlobalMenuOpen = useAtomValue(isGlobalMenuSheetOpenAtom);
    const isPlayerlistOpen = useAtomValue(isPlayerlistSheetOpenAtom);
    const openGlobalMenu = () => {
        setGlobalMenu(true);
    };
    const closeLeftSheets = () => {
        setGlobalMenu(false);
    };
    const openPlayerlist = () => {
        setPlayerlist(true);
    };
    const closePlayerlist = () => {
        setPlayerlist(false);
    };

    const touchStart = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            touchStart.current = { x: touch.clientX, y: touch.clientY };
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!touchStart.current) return;
            const touch = e.changedTouches[0];
            const dx = touch.clientX - touchStart.current.x;
            const dy = touch.clientY - touchStart.current.y;
            const startX = touchStart.current.x;
            touchStart.current = null;

            // Ignore vertical swipes
            if (Math.abs(dy) > Math.abs(dx)) return;
            if (Math.abs(dx) < SWIPE_THRESHOLD) return;

            const screenWidth = window.innerWidth;
            const isFromLeftEdge = startX < EDGE_ZONE;
            const isFromRightEdge = startX > screenWidth - EDGE_ZONE;
            const isSwipeRight = dx > 0;
            const isSwipeLeft = dx < 0;

            if (isSwipeRight) {
                if (isPlayerlistOpen) {
                    closePlayerlist();
                } else if (isFromLeftEdge) {
                    openGlobalMenu();
                }
            } else if (isSwipeLeft) {
                if (isGlobalMenuOpen) {
                    closeLeftSheets();
                } else if (isFromRightEdge) {
                    openPlayerlist();
                }
            }
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });
        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isGlobalMenuOpen, isPlayerlistOpen, setGlobalMenu, setPlayerlist]);
};
