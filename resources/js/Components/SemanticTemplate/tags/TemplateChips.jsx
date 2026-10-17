import { useContext } from "react";
import Link from "@/Components/Link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import { cn, getValueObject } from "@/lib/utils";
import SemanticTemplate from "../SemanticTemplate";
import { InsideLinkContext } from "./linkContext";
import useRecordLink from "./useRecordLink";

export const DEFAULT_MAX_CHIPS = 3;

const CHIP_CLASS =
  "inline-flex max-w-full items-center rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs";

/**
 * Batas chip dari atribut/kolom: angka >= 0; selain itu default 3. `0` = semua.
 * @param {unknown} max
 * @returns {number}
 */
export function resolveMaxChips(max) {
  if (max == null || max === "") {
    return DEFAULT_MAX_CHIPS;
  }
  const number = Number(max);

  return Number.isInteger(number) && number >= 0 ? number : DEFAULT_MAX_CHIPS;
}

/**
 * Satu chip: isi dari template kolom (relasi milik kolom) atau `templateLink`
 * record anak (tanpa `<title>`), bisa diklik ke record anak.
 * @param {object} props
 * @param {object} props.item record anak
 * @param {string} props.path path relasi pada baris induk
 * @param {number} props.index posisi anak dalam relasi
 * @param {object} props.row baris induk
 * @param {object} [props.column] kolom pemilik (route, template, ...)
 * @param {string} [props.template] template chip milik kolom
 * @returns {JSX.Element}
 */
function Chip({ item, path, index, row, column, template }) {
  const inside = useContext(InsideLinkContext);
  const link = useRecordLink(row, {
    to: `${path}.${index}`,
    column,
    enabled: !inside,
  });
  const content = (
    <SemanticTemplate
      template={template ?? item?.templateLink ?? ""}
      row={item}
      column={template ? column : undefined}
      context="chip"
    />
  );

  if (!link) {
    return (
      <span data-slot="chip" className={CHIP_CLASS}>
        {content}
      </span>
    );
  }

  return (
    <Link
      data-slot="chip"
      href={link.href}
      className={cn(
        CHIP_CLASS,
        "text-blue-800 dark:text-blue-200 hover:underline",
      )}
    >
      <InsideLinkContext.Provider value={true}>
        {content}
      </InsideLinkContext.Provider>
    </Link>
  );
}

/**
 * <chips of="rel" max="n"> / kolom `type: 'relations'` -- daftar chip relasi
 * banyak. Tampil `max` chip (0 = semua), sisanya diringkas "+N" (popover).
 * @param {object} props
 * @param {string} [props.of] path relasi; default nama kolom
 * @param {number|string} [props.max]
 * @param {object} props.row
 * @param {object} [props.column]
 * @returns {JSX.Element|null}
 */
export default function TemplateChips({ of, max, row, column }) {
  const path = of || column?.name;
  const items = path ? getValueObject(row, path) : null;
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  // `max`/`template` kolom hanya berlaku bila relasi yang dirender milik kolom itu.
  const own = !of || of === column?.name;
  const limit = resolveMaxChips(max ?? (own ? column?.max : undefined));
  const visibleCount =
    limit === 0 ? items.length : Math.min(items.length, limit);
  const rest = items.length - visibleCount;
  const template = own ? column?.template : undefined;

  const renderChip = (item, index) => (
    <Chip
      key={item?.id ?? index}
      item={item}
      index={index}
      path={path}
      row={row}
      column={column}
      template={template}
    />
  );

  return (
    <span className="flex flex-wrap items-center gap-1" data-slot="chips">
      {items
        .slice(0, visibleCount)
        .map((item, index) => renderChip(item, index))}
      {rest > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(CHIP_CLASS, "cursor-pointer hover:bg-muted")}
            >
              +{rest}
            </button>
          </PopoverTrigger>
          <PopoverContent className="flex w-auto max-w-xs flex-col items-start gap-1 p-2">
            {items
              .slice(visibleCount)
              .map((item, index) => renderChip(item, visibleCount + index))}
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
}
