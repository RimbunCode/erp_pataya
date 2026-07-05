import { useEffect, useRef } from "react";

import { GooeyToaster } from "@/Components/ui/goey-toaster";
import { setupInertiaToast } from "@/lib/inertiaToast";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * Root toast global. Dipasang sekali di entry point (app.jsx) di LUAR <App>
 * Inertia, sehingga Toaster dan listener loading TIDAK ikut remount saat
 * berpindah halaman. Ini wajib agar loading toast bisa diperbarui in-place
 * menjadi success/error setelah navigasi selesai (jika dipasang di dalam page
 * tree, toast loading akan hilang saat page component di-swap).
 * @returns {React.JSX.Element}
 */
export default function GooeyToastRoot() {
  const { t } = useLaravelReactI18n();
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    const teardown = setupInertiaToast({ t: (key) => tRef.current(key) });
    return teardown;
  }, []);

  return <GooeyToaster closeButton />;
}
