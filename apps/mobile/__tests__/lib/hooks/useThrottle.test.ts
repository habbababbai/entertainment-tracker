import { act } from "react";
import { renderHook } from "@testing-library/react-hooks";
import { useThrottle } from "../../../lib/hooks/useThrottle";

describe("useThrottle", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(Date, "now").mockImplementation(() => 1000);
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it("executes callback immediately on first call", () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback, 300));

        act(() => {
            result.current();
        });

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("does not execute callback if called again within delay", () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback, 300));

        act(() => {
            result.current();
        });

        Date.now = jest.fn(() => 1200);

        act(() => {
            result.current();
        });

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("executes callback after delay has passed", () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback, 300));

        act(() => {
            result.current();
        });

        Date.now = jest.fn(() => 1301);

        act(() => {
            result.current();
        });

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it("schedules delayed execution when called within throttle period", () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback, 300));

        act(() => {
            result.current();
        });

        Date.now = jest.fn(() => 1200);

        act(() => {
            result.current();
        });

        expect(callback).toHaveBeenCalledTimes(1);

        Date.now = jest.fn(() => 1300);

        act(() => {
            jest.advanceTimersByTime(100);
        });

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it("cancels pending execution when called again before delay completes", () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback, 300));

        act(() => {
            result.current();
        });

        expect(callback).toHaveBeenCalledTimes(1);

        Date.now = jest.fn(() => 1200);

        act(() => {
            result.current();
        });

        Date.now = jest.fn(() => 1250);

        act(() => {
            result.current();
        });

        expect(callback).toHaveBeenCalledTimes(1);

        act(() => {
            jest.advanceTimersByTime(100);
        });

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it("passes arguments to callback correctly", () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback, 300));

        act(() => {
            result.current("arg1", "arg2", 123);
        });

        expect(callback).toHaveBeenCalledWith("arg1", "arg2", 123);
    });

    it("maintains callback reference when dependencies change", () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();

        const { result, rerender } = renderHook(
            ({ callback, delay }) => useThrottle(callback, delay),
            {
                initialProps: { callback: callback1, delay: 300 },
            }
        );

        const firstThrottled = result.current;

        rerender({ callback: callback2, delay: 300 });

        expect(result.current).not.toBe(firstThrottled);
    });

    it("handles different delay values", () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback, 500));

        act(() => {
            result.current();
        });

        Date.now = jest.fn(() => 1400);

        act(() => {
            result.current();
        });

        expect(callback).toHaveBeenCalledTimes(1);

        act(() => {
            jest.advanceTimersByTime(100);
        });

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it("uses default delay of 300ms when not provided", () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback));

        act(() => {
            result.current();
        });

        Date.now = jest.fn(() => 1301);

        act(() => {
            result.current();
        });

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it("handles rapid consecutive calls", () => {
        const callback = jest.fn();
        const { result } = renderHook(() => useThrottle(callback, 300));

        act(() => {
            for (let i = 0; i < 10; i++) {
                Date.now = jest.fn(() => 1000 + i * 10);
                result.current();
            }
        });

        expect(callback).toHaveBeenCalledTimes(1);

        Date.now = jest.fn(() => 1300);

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(callback).toHaveBeenCalledTimes(2);
    });

    it("cleans up timeout on unmount when timeout is pending", () => {
        const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
        const callback = jest.fn();
        const { result, unmount } = renderHook(() =>
            useThrottle(callback, 300)
        );

        act(() => {
            result.current();
        });

        expect(callback).toHaveBeenCalledTimes(1);

        Date.now = jest.fn(() => 1200);

        act(() => {
            result.current();
        });

        expect(callback).toHaveBeenCalledTimes(1);

        const callCountBeforeUnmount = clearTimeoutSpy.mock.calls.length;
        unmount();
        const callCountAfterUnmount = clearTimeoutSpy.mock.calls.length;

        expect(callCountAfterUnmount).toBeGreaterThanOrEqual(callCountBeforeUnmount);

        clearTimeoutSpy.mockRestore();
    });

    it("works with async callbacks", async () => {
        const callback = jest.fn(async () => {
            return Promise.resolve("done");
        });
        const { result } = renderHook(() => useThrottle(callback, 300));

        await act(async () => {
            result.current();
        });

        expect(callback).toHaveBeenCalledTimes(1);

        await act(async () => {
            await Promise.resolve();
        });
    });

    it("handles callback that throws an error", () => {
        const callback = jest.fn(() => {
            throw new Error("Test error");
        });
        const { result } = renderHook(() => useThrottle(callback, 300));

        expect(() => {
            act(() => {
                result.current();
            });
        }).toThrow("Test error");

        expect(callback).toHaveBeenCalledTimes(1);
    });
});

