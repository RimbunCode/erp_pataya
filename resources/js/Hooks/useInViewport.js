import { useEffect, useState } from "react";

// Optimasi dashboard (opsi C): block yang fetch data sendiri (NumberCard/
// Chart/QuickList) tidak perlu langsung nembak request begitu Desk dibuka —
// kalau block ada di luar viewport (dashboard panjang, banyak section),
// tunda fetch sampai block itu discroll mendekati layar. Mencegah
// thundering-herd N request paralel saat halaman pertama kali dibuka.
//
// Sekali `true`, TETAP `true` (observer disconnect setelah intersect
// pertama) — block yang sudah pernah kelihatan tidak perlu fetch ulang
// tiap kali discroll keluar-masuk viewport.
export default function useInViewport(ref, { rootMargin = "200px" } = {}) {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (isInView) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [ref, isInView, rootMargin]);

  return isInView;
}
