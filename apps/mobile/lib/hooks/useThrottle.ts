import { useCallback, useRef } from "react";

/**
 * Throttles a callback function, ensuring it executes at most once per specified delay.
 * Useful for scroll handlers or events that fire frequently.
 *
 * @param callback - The function to throttle
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns A throttled version of the callback
 *
 * @example
 * ```tsx
 * const handleScroll = useThrottle(() => {
 *   // This will execute at most once every 300ms
 *   updateScrollPosition();
 * }, 300);
 * ```
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
    callback: T,
    delay: number = 300
): T {
    const lastExecutedRef = useRef<number>(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const throttledCallback = useCallback(
        (...args: Parameters<T>) => {
            const now = Date.now();
            const timeSinceLastExecution = now - lastExecutedRef.current;

            if (timeSinceLastExecution >= delay) {
                lastExecutedRef.current = now;
                callback(...args);
            } else {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }

                timeoutRef.current = setTimeout(() => {
                    lastExecutedRef.current = Date.now();
                    callback(...args);
                    timeoutRef.current = null;
                }, delay - timeSinceLastExecution);
            }
        },
        [callback, delay]
    ) as T;

    return throttledCallback;
}
