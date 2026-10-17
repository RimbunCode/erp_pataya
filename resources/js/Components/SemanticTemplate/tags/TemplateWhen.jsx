import { getValueObject } from "@/lib/utils";
import { isFilled } from "./utils";

/**
 * <when field="x"> -- render anak hanya bila field terisi (truthy).
 * @param {object} props
 * @param {string} [props.field] path field di baris
 * @param {object} [props.row]
 * @param {import("react").ReactNode} [props.children]
 * @returns {JSX.Element|null}
 */
export default function TemplateWhen({ field, row, children }) {
  if (!field || !isFilled(getValueObject(row, field))) {
    return null;
  }

  return <>{children}</>;
}
