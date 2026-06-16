import { gooeyToast } from "goey-toast";

/**
 * Memetakan varian Alert lama (toast.custom) ke tipe standar goey-toast.
 * @param {"destructive"|"warning"|"success"|"info"|string} variant
 * @returns {"error"|"warning"|"success"|"info"}
 */
const variantToType = (variant) => {
  if (variant === "destructive") {
    return "error";
  }

  if (variant === "warning" || variant === "success" || variant === "info") {
    return variant;
  }

  return "info";
};

/**
 * Pengganti pola `toast.custom((id) => <Alert variant ...>)` lama: menampilkan
 * toast standar goey-toast dengan tipe yang setara, tanpa merender komponen Alert.
 * @param {string} variant - varian Alert lama (destructive|warning|success|info)
 * @param {string} title
 * @param {import("goey-toast").GooeyToastOptions} [options]
 * @returns {string|number} id toast
 */
export const toastAlert = (variant, title, options = {}) => {
  const type = variantToType(variant);
  const fn = gooeyToast[type] ?? gooeyToast.info;

  return fn(title, options);
};

export { gooeyToast };
export default gooeyToast;
