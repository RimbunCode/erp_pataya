import { FormPageContext } from "@/Pages/Core/FormPage";
import { get } from "lodash";
import { useContext } from "react";

/**
 * Logic murni resolusi canUpdate — terpisah dari useContext supaya bisa
 * di-unit-test tanpa render environment (project ini tidak memakai
 * @testing-library/react-hooks / jsdom).
 * @param {string} fieldPath nama field (top-level) atau path dot-notation
 *   di dalam struktur canUpdate (mis. "qty" saat dipanggil dgn row).
 * @param {object} [row] data row child (mis. item FormTable) — bila
 *   diberikan, canUpdate DIBACA DARI row.canUpdate (hasil closure parent
 *   yang sudah di-attach backend), BUKAN dari defaultData.canUpdate.
 * @param {{defaultData?: object, disabled?: boolean}} [ctx] nilai
 *   FormPageContext (atau `{}` bila context undefined).
 * @returns {boolean}
 */
export function resolveCanUpdate(fieldPath, row, ctx) {
  const { defaultData, disabled: propDisabled } = ctx ?? {};

  if (propDisabled) return false;
  if (defaultData?.disabledOn) return false;

  const source = row ? row?.canUpdate : defaultData?.canUpdate;

  if (typeof source === "boolean") return source;
  if (source == null) return true;

  const value = get(source, fieldPath);
  if (typeof value === "boolean") return value;

  return true;
}

/**
 * Resolve status boleh-edit satu field, mengikuti kontrak backend canUpdate
 * (App\Traits\LinkModel::getCanUpdateAttribute) + disabledOn (whole-form
 * kill-switch, short-circuit lebih dulu).
 * @param {string} fieldPath
 * @param {object} [row]
 * @returns {boolean}
 */
export default function useCanUpdate(fieldPath, row) {
  const context = useContext(FormPageContext);

  return resolveCanUpdate(fieldPath, row, context);
}
