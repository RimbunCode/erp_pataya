/**
 * Menyorot kata pencarian di dalam teks.
 *
 * Logika mengikuti convertTemplateLink di resources/js/lib/linkModelUtils.js:
 * setiap kata pada `search` (dipisah whitespace, karakter regex di-escape)
 * dicocokkan case-insensitive dan dibungkus <mark>.
 * @param {string} text Teks sumber.
 * @param {string|null|undefined} search Kata pencarian (boleh berisi banyak kata).
 * @returns {string|Array<string|JSX.Element>} Teks asli bila tidak ada yang perlu disorot,
 *   selain itu array berisi string dan elemen <mark>.
 */
export function highlightText(text, search) {
  if (!text || !search || !String(search).trim()) {
    return text;
  }

  const words = String(search)
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter((word) => word.length > 0);

  if (words.length < 1) {
    return text;
  }

  // Dengan grup penangkap, index ganjil pada hasil split adalah bagian yang cocok.
  const regex = new RegExp(`(${words.join("|")})`, "gi");

  return String(text)
    .split(regex)
    .map((part, index) =>
      index % 2 === 1 ? (
        <mark key={index} className="bg-yellow-500">
          {part}
        </mark>
      ) : (
        part
      ),
    );
}
