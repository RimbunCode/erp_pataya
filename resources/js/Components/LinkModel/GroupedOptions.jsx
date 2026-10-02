import { ChevronRight } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import { CommandItem } from "@/Components/ui/command";
import LoadingIcon from "@/Components/LoadingIcon";
import GroupLabel from "@/Components/Table/Group/GroupLabel";
import GroupTree from "@/Components/Table/Group/GroupTree";
import { groupLabelValue } from "@/Components/Table/Group/groupDisplay";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { cn } from "@/lib/utils";
import InfiniteScrollSentinel from "./InfiniteScrollSentinel";

// Value cmdk utk baris header grup -- diawali penanda supaya tak pernah
// bentrok dgn `value` opsi data (`${id}`) maupun sentinel aksi LinkModel.
export const GROUP_HEADER_PREFIX = "__linkmodel_group__";
export const groupHeaderValue = (pathKey) => `${GROUP_HEADER_PREFIX}${pathKey}`;
export const isGroupHeaderValue = (value) =>
  typeof value === "string" && value.startsWith(GROUP_HEADER_PREFIX);

const indentStyle = (depth) => ({ paddingLeft: `${depth * 12 + 8}px` });

/**
 * GroupedOptions — opsi dropdown LinkModel sebagai pohon grup lazy (spec
 * linkmodel-grouping-search Requirement 8). Header grup = `CommandItem`
 * non-seleksi (Enter/klik membuka-menutup), anak `rows` = `CommandItem` opsi
 * biasa. Isi tiap grup di-fetch lewat `fetcher` saat dibuka (mode infinite:
 * halaman ditambahkan saat sentinel terlihat, tanpa pager).
 *
 * @param {object} props
 * @param {Array} props.rootItems deskriptor grup level-0 (halaman-halaman yang sudah dimuat)
 * @param {Array} props.levels `groupMeta.levels` atau level lokal
 * @param {object} [props.baseParams] param dasar expand (fetcher server)
 * @param {(args: object) => Promise<object>} props.fetcher
 * @param {string} [props.pathname] identitas cache query (default: "linkmodel")
 * @param {string} props.resetKey ganti -> pohon di-remount (state terbuka reset)
 * @param {string} [props.search] ketikan sekarang (highlight baris + auto-expand)
 * @param {{budget: number}} [props.autoExpand]
 * @param {boolean} [props.hasNextRoot] masih ada halaman level-0 berikutnya
 * @param {() => void} [props.fetchNextRoot]
 * @param {boolean} [props.fetchingRoot]
 * @param {(row: object) => void} props.onPick
 * @param {{current: Map<string, object>}} [props.knownRef] registri baris yg pernah dirender (Tab-autocomplete / exact-match)
 * @param {number|string} [props.version]
 */
export default function GroupedOptions({
  rootItems,
  levels,
  baseParams,
  fetcher,
  pathname = "linkmodel",
  resetKey,
  search,
  autoExpand,
  hasNextRoot,
  fetchNextRoot,
  fetchingRoot,
  onPick,
  knownRef,
  version = 0,
}) {
  const { t } = useLaravelReactI18n();

  return (
    <>
      <GroupTree
        key={resetKey}
        rootItems={rootItems}
        levels={levels}
        baseParams={baseParams ?? {}}
        pathname={pathname}
        fetcher={fetcher}
        infinite
        version={version}
        autoExpand={autoExpand}
        autoExpandKey={search ?? ""}
        renderGroupHeader={({
          item,
          depth,
          level,
          isOpen,
          onToggle,
          pager,
          pathKey,
        }) => (
          <CommandItem
            value={groupHeaderValue(pathKey)}
            onSelect={onToggle}
            aria-expanded={isOpen}
            data-testid="linkmodel-group-header"
            className="font-medium"
            style={indentStyle(depth)}
          >
            <ChevronRight
              className={cn(
                "size-4 shrink-0 transition-transform",
                isOpen && "rotate-90",
              )}
            />
            <span className="flex items-center gap-1 min-w-0">
              <GroupLabel
                type={level?.type}
                column={
                  level?.valueTrans || level?.parse
                    ? { valueTrans: level.valueTrans, parse: level.parse }
                    : undefined
                }
                value={groupLabelValue(item, level)}
                granularity={level?.granularity}
                rangeSize={level?.range}
              />
              <span className="text-muted-foreground">({item.count})</span>
            </span>
            {pager}
          </CommandItem>
        )}
        renderRow={(row, { depth, index }) => {
          const value = `${row.id ?? `${depth}-${index}`}`;
          knownRef?.current?.set(value, row);

          return (
            <CommandItem
              key={value}
              value={value}
              onSelect={() => onPick(row)}
              style={indentStyle(depth)}
            >
              <p
                dangerouslySetInnerHTML={{
                  // search dipaksa "" bila kosong -- convertTemplateLink hanya
                  // meng-escape HTML di jalur search!=null (lihat komentar
                  // LinkModel.jsx dropdown flat).
                  __html: convertTemplateLink(row, search ?? ""),
                }}
              />
            </CommandItem>
          );
        }}
        renderLoading={({ depth }) => (
          <div
            role="status"
            className="flex items-center gap-2 py-2 text-xs text-muted-foreground"
            style={indentStyle(depth)}
          >
            <LoadingIcon className="size-3" />
            {t("core.datatable.group_loading")}
          </div>
        )}
        renderError={({ depth, onRetry }) => (
          <div
            role="alert"
            className="flex items-center gap-2 py-2 text-xs text-destructive"
            style={indentStyle(depth)}
          >
            {t("core.datatable.group_error")}
            <button
              type="button"
              className="underline"
              onClick={onRetry}
            >
              {t("core.datatable.group_retry")}
            </button>
          </div>
        )}
      />
      <InfiniteScrollSentinel
        onIntersect={fetchNextRoot ?? (() => {})}
        enabled={!!hasNextRoot}
        loading={!!fetchingRoot}
      />
    </>
  );
}
