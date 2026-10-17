import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { cn, resolveImageSrc } from "@/lib/utils";

/**
 * Inisial dari dua kata pertama nama (pola kolom `type: image` di Cell).
 * @param {string} name
 * @returns {string}
 */
function initials(name) {
  return String(name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("");
}

/**
 * <avatar src="…" name="…"/> -- foto atau inisial.
 * @param {object} props
 * @param {string} [props.src] file-ID atau URL gambar
 * @param {string} [props.name]
 * @param {string} [props.className]
 * @returns {JSX.Element}
 */
export default function TemplateAvatar({ src, name, className }) {
  let imageSrc = null;
  try {
    imageSrc = src ? resolveImageSrc(src) : null;
  } catch {
    imageSrc = null;
  }

  return (
    <Avatar className={cn("size-8 border", className)}>
      {imageSrc && <AvatarImage src={imageSrc} alt={name ?? ""} />}
      <AvatarFallback className="text-xs font-semibold text-muted-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
