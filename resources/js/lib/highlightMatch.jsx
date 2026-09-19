import { isNullOrWhitespace } from "@/lib/utils";

// Highlight tanpa dangerouslySetInnerHTML: pecah teks jadi array React node
// (teks biasa + <mark> untuk bagian yang cocok). React meng-escape otomatis,
// sehingga aman dari XSS meski teks/search berisi karakter HTML. Diadaptasi
// dari highlightItem di MultiSelect.jsx (Select.jsx punya versi lain yang
// pakai dangerouslySetInnerHTML -- sengaja tidak dipakai di sini).
export function highlightMatch(text, search) {
  const value = `${text ?? ""}`;
  const searchWords =
    search
      ?.split(/\s+/)
      ?.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter((x) => !isNullOrWhitespace(x)) || [];
  if (searchWords.length < 1) return value;
  const splitRegex = new RegExp(`(${searchWords.join("|")})`, "gi");
  const matchRegex = new RegExp(`^(?:${searchWords.join("|")})$`, "i");
  return value
    .split(splitRegex)
    .filter((part) => part !== "")
    .map((part, i) =>
      matchRegex.test(part) ? (
        <mark key={i} className="bg-yellow-500">
          {part}
        </mark>
      ) : (
        part
      ),
    );
}
