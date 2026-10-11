import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Deteksi tekan-tahan (long-press) via Pointer Events.
 *
 * - Timer dimulai di `pointerdown`, dibatalkan oleh `pointerup`/`pointercancel`/
 *   `pointerleave`, atau `pointermove` yang melewati `moveThreshold` px
 *   (gerakan scroll tidak boleh memicu long-press).
 * - Setelah timer menembak, flag internal `fired` di-set; `consumeLongPress()`
 *   mengembalikan true sekali (lalu reset) agar handler click yang menyusul
 *   dapat diabaikan.
 * - `onContextMenu` di-preventDefault supaya menu konteks native tidak muncul.
 */
export default function useLongPress({
  onLongPress,
  delay = 500,
  moveThreshold = 10,
} = {}) {
  const timerRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const firedRef = useRef(false);
  const onLongPressRef = useRef(onLongPress);

  useEffect(() => {
    onLongPressRef.current = onLongPress;
  });

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const onPointerDown = useCallback(
    (event) => {
      cancel();
      firedRef.current = false;
      startRef.current = { x: event.clientX, y: event.clientY };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        onLongPressRef.current?.();
      }, delay);
    },
    [cancel, delay],
  );

  const onPointerMove = useCallback(
    (event) => {
      if (timerRef.current === null) {
        return;
      }
      const dx = event.clientX - startRef.current.x;
      const dy = event.clientY - startRef.current.y;
      if (Math.hypot(dx, dy) > moveThreshold) {
        cancel();
      }
    },
    [cancel, moveThreshold],
  );

  const onContextMenu = useCallback((event) => {
    event.preventDefault();
  }, []);

  const consumeLongPress = useCallback(() => {
    const fired = firedRef.current;
    firedRef.current = false;
    return fired;
  }, []);

  const handlers = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu,
    }),
    [onPointerDown, onPointerMove, cancel, onContextMenu],
  );

  return { handlers, consumeLongPress };
}
