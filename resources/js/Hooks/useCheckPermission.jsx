import { checkPermission } from "@/lib/utils";
import { usePage } from "@inertiajs/react";

/**
 * Hook untuk mengecek izin akses dari props Inertia.
 * @returns {{ can: (model: string, action: string, level?: number) => { allowed: boolean, onlyCreator: boolean } }}
 */
export default function usePermission() {
  const { permissions } = usePage().props;

  /**
   * @param {string} model
   * @param {string} action
   * @param {number} [level] level akses (default 0)
   * @returns {{ allowed: boolean, onlyCreator: boolean }}
   */
  const can = (model, action, level = 0) => {
    return checkPermission(permissions, model, action, level);
  };

  return { can };
}
