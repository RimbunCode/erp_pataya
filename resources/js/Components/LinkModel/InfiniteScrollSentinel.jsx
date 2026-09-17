import { useEffect, useRef } from "react";

import LoadingIcon from "@/Components/LoadingIcon";

/**
 * Sentinel infinite scroll — IntersectionObserver yang RE-ARM tiap kali
 * `enabled` berubah jadi true (beda dari `useInViewport`, yang sekali
 * intersect langsung disconnect permanen -- cocok utk lazy-load sekali, TIDAK
 * cocok utk trigger berulang tiap halaman baru). Dipasang di baris/item
 * terakhir daftar Advance Search Dialog.
 * @param {object} props
 * @param {() => void} props.onIntersect dipanggil saat sentinel masuk viewport
 * @param {boolean} props.enabled false saat tidak ada halaman berikutnya (hasNextPage)
 * @param {boolean} [props.loading] tampilkan indikator loading saat true
 * @returns {React.JSX.Element|null}
 */
export default function InfiniteScrollSentinel({
  onIntersect,
  enabled,
  loading,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onIntersect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [enabled, onIntersect]);

  if (!enabled && !loading) return null;

  return (
    <div ref={ref} className="flex justify-center py-3">
      {loading && <LoadingIcon className="size-4" />}
    </div>
  );
}
