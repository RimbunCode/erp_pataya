import BadgeStatus from "@/Components/BadgeStatus";
import { childrenToText } from "./utils";

/**
 * <status>nilai</status> -> badge status dokumen (`BadgeStatus` existing).
 * @param {object} props
 * @param {string} [props.className]
 * @param {import("react").ReactNode} props.children teks = kode status
 * @returns {JSX.Element|null}
 */
export default function TemplateStatus({ className, children }) {
  const status = childrenToText(children).trim();
  if (status === "") {
    return null;
  }

  return (
    <BadgeStatus
      status={status}
      className={className ?? "text-xs py-0.5 px-2"}
    />
  );
}
