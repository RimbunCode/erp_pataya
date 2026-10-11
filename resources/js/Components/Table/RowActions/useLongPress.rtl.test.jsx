import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useLongPress from "./useLongPress";

function Harness({ onLongPress, probe, ...opts }) {
  const { handlers, consumeLongPress } = useLongPress({ onLongPress, ...opts });
  probe?.(consumeLongPress);
  return <div data-testid="target" {...handlers} />;
}

function setup(opts = {}) {
  const onLongPress = vi.fn();
  let consume;
  render(
    <Harness
      onLongPress={onLongPress}
      probe={(c) => {
        consume = c;
      }}
      {...opts}
    />,
  );
  return {
    el: screen.getByTestId("target"),
    onLongPress,
    consume: () => consume(),
  };
}

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("menahan 500ms memanggil onLongPress sekali", () => {
    const { el, onLongPress } = setup();
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(499));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(2000));
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("delay dapat dikonfigurasi", () => {
    const { el, onLongPress } = setup({ delay: 200 });
    fireEvent.pointerDown(el, { clientX: 0, clientY: 0 });
    act(() => vi.advanceTimersByTime(200));
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("pointerup sebelum 500ms membatalkan", () => {
    const { el, onLongPress, consume } = setup();
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.pointerUp(el);
    act(() => vi.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();
    expect(consume()).toBe(false);
  });

  it("pointercancel dan pointerleave membatalkan", () => {
    const { el, onLongPress } = setup();
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
    fireEvent.pointerCancel(el);
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
    fireEvent.pointerLeave(el);
    act(() => vi.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("bergerak lebih dari 10px membatalkan (scroll tidak memicu long-press)", () => {
    const { el, onLongPress } = setup();
    fireEvent.pointerDown(el, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(el, { clientX: 100, clientY: 120 });
    act(() => vi.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("bergerak kecil (<= 10px) tidak membatalkan", () => {
    const { el, onLongPress } = setup();
    fireEvent.pointerDown(el, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(el, { clientX: 104, clientY: 103 });
    act(() => vi.advanceTimersByTime(500));
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("moveThreshold dapat dikonfigurasi", () => {
    const { el, onLongPress } = setup({ moveThreshold: 2 });
    fireEvent.pointerDown(el, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(el, { clientX: 5, clientY: 0 });
    act(() => vi.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("consumeLongPress() true sekali setelah long-press lalu false", () => {
    const { el, consume } = setup();
    expect(consume()).toBe(false);
    fireEvent.pointerDown(el, { clientX: 1, clientY: 1 });
    act(() => vi.advanceTimersByTime(500));
    expect(consume()).toBe(true);
    expect(consume()).toBe(false);
  });

  it("pointerdown baru mereset flag fired dari long-press sebelumnya", () => {
    const { el, consume } = setup();
    fireEvent.pointerDown(el, { clientX: 1, clientY: 1 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(el);
    fireEvent.pointerDown(el, { clientX: 1, clientY: 1 });
    fireEvent.pointerUp(el);
    expect(consume()).toBe(false);
  });

  it("contextmenu di-preventDefault", () => {
    const { el } = setup();
    const notPrevented = fireEvent.contextMenu(el);
    expect(notPrevented).toBe(false);
  });

  it("memakai onLongPress terbaru", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useLongPress({ onLongPress: cb }),
      { initialProps: { cb: first } },
    );
    act(() => result.current.handlers.onPointerDown({ clientX: 0, clientY: 0 }));
    rerender({ cb: second });
    act(() => vi.advanceTimersByTime(500));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("timer dibersihkan saat unmount", () => {
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() => useLongPress({ onLongPress }));
    act(() => result.current.handlers.onPointerDown({ clientX: 0, clientY: 0 }));
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
