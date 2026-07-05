import { GooeyToaster as Base } from "goey-toast";

import useTheme from "@/Hooks/useTheme";

/**
 * Wrapper GooeyToaster dengan konfigurasi standar aplikasi.
 *
 * Membaca tema aktif (sudah ter-resolve dari 'system') via useTheme, lalu
 * meneruskannya ke goey-toast. Konfigurasi wajib: spring, preset smooth,
 * durasi 5 detik, posisi top-center. Props tambahan dapat meng-override
 * lewat spread di akhir.
 * @param {object} root0
 * @returns {React.JSX.Element}
 */
const GooeyToaster = ({ ...props }) => {
  const { currentTheme } = useTheme();

  return (
    <Base
      theme={currentTheme === "dark" ? "dark" : "light"}
      position="top-center"
      spring
      preset="smooth"
      duration={5000}
      {...props}
    />
  );
};

export { GooeyToaster };
export default GooeyToaster;
