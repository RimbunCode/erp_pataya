import { checkPermission, inArray } from "@/lib/utils";

import { usePage } from "@inertiajs/react";

/**
 * @typedef {object} Options
 * @param {string} user_id
 * @param {number} [level] level akses (default 0)
 * @property {string} className
 */

/**
 * Hook untuk mengecek izin akses dari props Inertia.
 * @param {string} model
 * @returns {{ can: (action: string, options?: Options) => boolean, canGlobal: (model: string, action: string, options?: Options) => boolean }}
 */
export default function usePermission(model) {
  const { permissions } = usePage().props;
  const { user } = usePage().props.auth;

  const _can = (model, action, options = { level: 0 }) => {
    options = options && typeof options === "object" ? options : { level: 0 };
    const result = checkPermission(permissions, model, action, options.level);
    const allowed =
      result.allowed &&
      (!inArray(["create", "import", "select"], action) && result.onlyCreator
        ? user.id === options.user_id
        : true);

    return allowed;
  };

  /**
   * @param {string} action
   * @param {Options} [options]
   * @returns {boolean}
   */
  const can = (action, options = { level: 0 }) => {
    return _can(model, action, options);
  };
  /**
   * @param {string} model
   * @param {string} action
   * @param {Options} [options]
   * @returns {boolean}
   */
  const canGlobal = (model, action, options = { level: 0 }) => {
    return _can(model, action, options);
  };

  return { can, canGlobal };
}
