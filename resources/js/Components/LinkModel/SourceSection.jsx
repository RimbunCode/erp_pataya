import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import { CommandItem } from "@/Components/ui/command";
import LoadingIcon from "@/Components/LoadingIcon";
import { normalizeGroupLevels } from "@/Components/Table/Group/groupLevels";
import useLinkModelInfiniteOptions, {
  LINKMODEL_PAGE_SIZE,
  fetchLinkModelGroupNode,
} from "@/Hooks/useLinkModelInfiniteOptions";
import { convertTemplateLink, sourceValue } from "@/lib/linkModelUtils";
import { cn } from "@/lib/utils";
import GroupedOptions from "./GroupedOptions";
import InfiniteScrollSentinel from "./InfiniteScrollSentinel";

// Value cmdk header bagian -- berprefiks penanda agar tak bentrok dgn value
// opsi data, header grup, maupun sentinel aksi LinkModel.
export const SOURCE_HEADER_PREFIX = "__linkmodel_source__";
export const sourceHeaderValue = (index) => `${SOURCE_HEADER_PREFIX}${index}`;
export const isSourceHeaderValue = (value) =>
  typeof value === "string" && value.startsWith(SOURCE_HEADER_PREFIX);

// Indentasi isi bagian (satu tingkat di bawah header bagian).
const SECTION_DEPTH = 1;
const indentStyle = (depth) => ({ paddingLeft: `${depth * 12 + 8}px` });

/**
 * Header bagian dropdown (LinkModel multi-model): `CommandItem` non-seleksi,
 * Enter/klik membuka-menutup. Dipakai bagian sub dan main (bila `mainLabel`).
 * @param {object} props
 * @param {number} props.index indeks sumber
 * @param {string} props.label
 * @param {boolean} props.isOpen
 * @param {() => void} props.onToggle
 * @param {boolean} [props.loading]
 * @returns {React.JSX.Element}
 */
export function SourceHeader({ index, label, isOpen, onToggle, loading }) {
  return (
    <CommandItem
      value={sourceHeaderValue(index)}
      onSelect={onToggle}
      aria-expanded={isOpen}
      data-testid="linkmodel-source-header"
      className="font-medium"
    >
      <ChevronRight
        className={cn(
          "size-4 shrink-0 transition-transform",
          isOpen && "rotate-90",
        )}
      />
      <span className="min-w-0 truncate">{label}</span>
      {loading && <LoadingIcon className="size-3 ml-auto" />}
    </CommandItem>
  );
}

/**
 * SourceSection -- satu bagian SUB model di dropdown LinkModel multi-model
 * (spec linkmodel-multi-model). Header buka-tutup; isi di-fetch LAZY (hanya
 * saat bagian terbuka atau user sedang mencari), flat berinfinite-scroll atau
 * pohon grup (`GroupedOptions`) sesuai `group` sumber ini. Hook fetch dipanggil
 * di komponen ini agar jumlah hook LinkModel tetap walau jumlah sub berubah.
 * @param {object} props
 * @param {{index: number, model: string, label: string, config: object}} props.source
 * @param {boolean} props.open dropdown LinkModel terbuka
 * @param {string} props.search ketikan sekarang
 * @param {boolean} props.allowSearch false saat `search` hanya sinkron ke label opsi terpilih
 * @param {number} [props.staleTime]
 * @param {(index: number, status: {hasResults: boolean, settled: boolean}) => void} props.onStatus
 * @param {(row: object) => void} props.onPick
 * @param {{current: Map<string, object>}} props.knownRef registri baris yg pernah dirender
 * @returns {React.JSX.Element|null}
 */
export default function SourceSection({
  source,
  open,
  search,
  allowSearch,
  staleTime,
  onStatus,
  onPick,
  knownRef,
}) {
  const { t } = useLaravelReactI18n();
  const { index, model, label, config } = source;
  const searching = allowSearch && !!search?.trim();

  // Pilihan user (klik header) menimpa default (terbuka hanya saat mencari);
  // direset tiap dropdown ditutup / ketikan berubah.
  const [openOverride, setOpenOverride] = useState(null);
  useEffect(() => {
    setOpenOverride(null);
  }, [open, search]);
  const isOpen = openOverride ?? searching;

  const groupKey = JSON.stringify(config.group ?? null);
  const groupProp = useMemo(
    () =>
      config.group === undefined || config.group === null
        ? undefined
        : normalizeGroupLevels(config.group),
    [groupKey],
  );

  // Saat mencari, tahan fetch sampai debounce hook menyamai ketikan -- tanpa ini
  // sub langsung fetch dgn `search` lama (kosong) lalu fetch ulang: request sia-sia
  // ke katalog yang bisa besar. `readyFor` diisi efek di bawah (hook tetap
  // men-debounce walau `open` false).
  const [readyFor, setReadyFor] = useState(null);
  const ready = !searching || readyFor === (search ?? "");
  const fetchEnabled = !!open && isOpen && (openOverride === true || ready);
  const searched = useLinkModelInfiniteOptions({
    model,
    filters: config.filters,
    joins: config.joins,
    with: config.with,
    fields: config.fields,
    keywords: config.keywords,
    order: config.order,
    translate: config.translate,
    search,
    open: fetchEnabled,
    allowSearch,
    group: groupProp,
    staleTime,
  });

  useEffect(() => {
    if ((searched.settledSearch ?? "") === (search ?? "")) {
      setReadyFor(search ?? "");
    }
  }, [searched.settledSearch, search]);

  const rows = searched.options;
  const hasResults = searched.isGrouped
    ? searched.rootItems.length > 0
    : rows.length > 0;
  const settled =
    fetchEnabled &&
    !searched.loading &&
    (searched.settledSearch ?? "") === (search ?? "");

  useEffect(() => {
    onStatus(index, { hasResults, settled });
  }, [index, hasResults, settled]);

  // Sedang mencari & hasil final kosong -> bagian disembunyikan.
  if (searching && settled && !hasResults) return null;

  const autoExpand =
    searching && settled ? { budget: LINKMODEL_PAGE_SIZE } : undefined;

  return (
    <>
      <SourceHeader
        index={index}
        label={label}
        isOpen={isOpen}
        loading={
          (fetchEnabled && searched.loading) || (isOpen && searching && !ready)
        }
        onToggle={() => setOpenOverride(!isOpen)}
      />
      {isOpen && !searched.loading && (
        <>
          {!hasResults && settled && (
            <div
              role="presentation"
              className="py-2 text-sm text-muted-foreground"
              style={indentStyle(SECTION_DEPTH)}
            >
              {t("core.form.not_found")}
            </div>
          )}
          {searched.isGrouped ? (
            <GroupedOptions
              rootItems={searched.rootItems}
              levels={searched.groupMeta?.levels ?? []}
              baseParams={searched.baseParams ?? {}}
              fetcher={fetchLinkModelGroupNode}
              pathname={`linkmodel:${model}`}
              resetKey={JSON.stringify(searched.baseParams)}
              search={allowSearch ? search : ""}
              autoExpand={autoExpand}
              hasNextRoot={searched.hasNextPage}
              fetchNextRoot={searched.fetchNextPage}
              fetchingRoot={searched.isFetchingNextPage}
              knownRef={knownRef}
              onPick={onPick}
              sourceIndex={index}
              depthOffset={SECTION_DEPTH}
            />
          ) : (
            <>
              {rows.map((row, i) => {
                const value = sourceValue(index, row.id ?? i);
                knownRef?.current?.set(value, row);

                return (
                  <CommandItem
                    key={value}
                    value={value}
                    onSelect={() => onPick(row)}
                    style={indentStyle(SECTION_DEPTH)}
                  >
                    <p
                      dangerouslySetInnerHTML={{
                        __html: convertTemplateLink(row, search ?? ""),
                      }}
                    />
                  </CommandItem>
                );
              })}
              <InfiniteScrollSentinel
                onIntersect={searched.fetchNextPage}
                enabled={searched.hasNextPage}
                loading={searched.isFetchingNextPage}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
