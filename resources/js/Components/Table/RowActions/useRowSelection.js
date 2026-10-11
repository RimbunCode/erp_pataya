import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * State seleksi baris lintas halaman/mode (desktop & mobile).
 *
 * Kunci Map = `row.id` apa adanya (ULID string atau number, tanpa coercion),
 * sehingga id "1" dan 1 dianggap berbeda. Objek baris terbaru selalu disimpan
 * agar `rows` tidak basi saat data dimuat ulang.
 *
 * `toggle`, `setMany`, dan `clear` stabil antar render (functional setState).
 * `isSelected` berubah identitas hanya saat isi seleksi berubah.
 * Seleksi dikosongkan saat `resetKey` berubah (selain render pertama).
 */
export default function useRowSelection({ resetKey } = {}) {
  const [selected, setSelected] = useState(() => new Map());

  const toggle = useCallback((row, checked) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) {
        next.set(row.id, row);
      } else {
        next.delete(row.id);
      }
      return next;
    });
  }, []);

  const setMany = useCallback((rows, checked) => {
    setSelected((prev) => {
      const next = new Map(prev);
      for (const row of rows) {
        if (checked) {
          next.set(row.id, row);
        } else {
          next.delete(row.id);
        }
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelected((prev) => (prev.size === 0 ? prev : new Map()));
  }, []);

  const isSelected = useCallback((row) => selected.has(row.id), [selected]);

  const rows = useMemo(() => Array.from(selected.values()), [selected]);

  // Lewati render pertama: seleksi awal memang kosong, dan reset tak perlu.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    clear();
  }, [resetKey, clear]);

  return {
    selected,
    rows,
    count: selected.size,
    isSelected,
    toggle,
    setMany,
    clear,
  };
}
