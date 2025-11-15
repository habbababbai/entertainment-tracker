import { act } from "react";
import { renderHook } from "@testing-library/react-hooks";
import { useDebounce } from "../../../lib/hooks/useDebounce";

describe("useDebounce", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it("returns initial value immediately", () => {
        const { result } = renderHook(() => useDebounce("initial", 300));

        expect(result.current).toBe("initial");
    });

    it("does not update value immediately when input changes", () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: "initial", delay: 300 },
            }
        );

        expect(result.current).toBe("initial");

        rerender({ value: "updated", delay: 300 });

        expect(result.current).toBe("initial");
    });

    it("updates value after delay has passed", () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: "initial", delay: 300 },
            }
        );

        rerender({ value: "updated", delay: 300 });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(result.current).toBe("updated");
    });

    it("resets timer when value changes before delay completes", () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: "initial", delay: 300 },
            }
        );

        rerender({ value: "intermediate", delay: 300 });

        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(result.current).toBe("initial");

        rerender({ value: "final", delay: 300 });

        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(result.current).toBe("initial");

        act(() => {
            jest.advanceTimersByTime(100);
        });

        expect(result.current).toBe("final");
    });

    it("handles different delay values", () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: "initial", delay: 500 },
            }
        );

        rerender({ value: "updated", delay: 500 });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(result.current).toBe("initial");

        act(() => {
            jest.advanceTimersByTime(200);
        });

        expect(result.current).toBe("updated");
    });

    it("works with number values", () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: 0, delay: 300 },
            }
        );

        rerender({ value: 42, delay: 300 });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(result.current).toBe(42);
    });

    it("works with object values", () => {
        const initial = { name: "initial" };
        const updated = { name: "updated" };

        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: initial, delay: 300 },
            }
        );

        rerender({ value: updated, delay: 300 });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(result.current).toBe(updated);
        expect(result.current.name).toBe("updated");
    });

    it("cleans up timeout on unmount", () => {
        const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

        const { unmount, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: "initial", delay: 300 },
            }
        );

        rerender({ value: "updated", delay: 300 });

        unmount();

        expect(clearTimeoutSpy).toHaveBeenCalled();

        clearTimeoutSpy.mockRestore();
    });

    it("updates immediately when delay is 0", () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            {
                initialProps: { value: "initial", delay: 0 },
            }
        );

        rerender({ value: "updated", delay: 0 });

        act(() => {
            jest.advanceTimersByTime(0);
        });

        expect(result.current).toBe("updated");
    });

    it("uses default delay of 300ms when not provided", () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebounce(value),
            {
                initialProps: { value: "initial" },
            }
        );

        rerender({ value: "updated" });

        act(() => {
            jest.advanceTimersByTime(300);
        });

        expect(result.current).toBe("updated");
    });
});

