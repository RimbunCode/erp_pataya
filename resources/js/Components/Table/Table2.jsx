import "@/../css/table.css";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import React, {
  cloneElement,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  cn,
  getCookieByName,
  getLocaleDate,
  removeCookie,
  resolveImageSrc,
  setCookie,
} from "@/lib/utils";
import { router, usePage } from "@inertiajs/react";

import BadgeStatus from "../BadgeStatus";
import { Checkbox } from "../ui/checkbox";
import ColumnsFilter from "./ColumnsFilter";
import GroupTree from "./Group/GroupTree";
import { GroupHeaderRow, GroupNodeStatusRow } from "./Group/GroupHeaderRow";
import { Dialog } from "../ui/dialog";
import Header from "./Header";
import Link from "../Link";
import LoadingIcon from "../LoadingIcon";
import NoDataImg from "./NoDataImg";
import { TZDate } from "@date-fns/tz";
import { formatNumber } from "@/Components/NumberInput/formatNumber";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { format } from "date-fns";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import useDynamicRefs from "@/Hooks/useDynamicRefs";
import { useLaravelReactI18n } from "laravel-react-i18n";
import usePermission from "@/Hooks/usePermission";

export const DATATABLE_COLUMNS_KEY = "datatable_columns";
const DATATABLE_COLUMNS_EXPIRED = 7; //days
// Lebar minimum kolom fr-default agar tak menyusut ilegibel saat kolom banyak;
// horizontal scroll (lihat table.css) menampung sisanya.
const MIN_COLUMN_WIDTH = 120;

// Sel body wrap by default (table.css `td span`). Tipe di bawah ini TAK
// di-wrap -- format angka/tanggal jadi ganjil kalau kepotong ke baris baru
// di tengah token, jadi tetap sebaris + potong (`!important`, lihat komentar
// table.css: selector gabungan lebih spesifik drpd utility polos).
const NOWRAP_CELL_TYPES = ["number", "currency", "date", "time", "datetime"];
const cellWrapClassName = (type) =>
  NOWRAP_CELL_TYPES.includes(type)
    ? "whitespace-nowrap! text-ellipsis!"
    : undefined;

// Konstanta grup pindah ke Group/groupLevels.js (spec datatable2-group-tree);
// di-re-export di sini supaya pemakai lama (ChipEditor, DataTable2, FilterTemplate
// Form) tak perlu berubah sekaligus. Helper bucket-key sisi client
// (dateGroupBucketKey/numberGroupBucketKey) DIHAPUS: batas grup kini datang dari
// server per node, jadi tak ada lagi "mirror manual" ekspresi SQL yg harus identik.
export {
  DATE_GROUP_GRANULARITIES,
  DEFAULT_NUMBER_GROUP_RANGE_OPTIONS,
} from "./Group/groupLevels";
// GroupLabel pindah ke Group/GroupLabel.jsx (hindari impor melingkar dgn header grup).
export { GroupLabel } from "./Group/GroupLabel";

// Nama cookie unik per-path agar tidak bentrok antar-halaman. Path-scoping cookie
// (nama sama beda path) rapuh: `document.cookie` tak mengekspos path sehingga
// browser tertentu (mis. Edge) bisa mengembalikan cookie path lain. Maka isolasi
// dilakukan lewat NAMA (suffix path ter-sanitize), bukan path cookie.
// Sanitizer HARUS identik dengan sisi backend (DataTableScope::datatableColumnsCookieKey):
//   trim slash → lowercase → ganti karakter non-alnum jadi "_".
export const datatableColumnsCookieKey = (pathname) => {
  const slug = String(pathname ?? "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `${DATATABLE_COLUMNS_KEY}_${slug}` : DATATABLE_COLUMNS_KEY;
};
export const convertColWidth = (colWidth) => {
  if (colWidth) {
    switch (colWidth) {
      case "grow":
        return "1fr";
      case "fit":
        return "max-content";
      case "minimum":
        return "min-content";
      default:
        return colWidth;
    }
  } else {
    return `minmax(${MIN_COLUMN_WIDTH}px, 1fr)`;
  }
};
export const createHeaders = (headers, ignoreCookie = false) => {
  const columnsFromCookie = ignoreCookie
    ? null
    : JSON.parse(
        getCookieByName(datatableColumnsCookieKey(window.location.pathname)) ||
          "null",
      );
  // const newHeaders = { ...headers };
  Object.values(headers).forEach((col) => {
    const colFromCookie = ignoreCookie ? null : columnsFromCookie?.[col.name];
    const show = colFromCookie
      ? true
      : columnsFromCookie && Object.keys(columnsFromCookie).length > 0
        ? false
        : (col.show ?? true);
    headers[col.name] = {
      ...col,
      sort: null,
      show: show,
      order: show ? colFromCookie?.order || col.order : undefined,
      size: colFromCookie?.size ?? convertColWidth(col.width),
    };
  });
  return Object.values(headers);
};
export const Cell = memo(
  ({
    row,
    cell,
    type,
    route,
    name,
    valueTrans,
    parse,
    primaryKey,
    isLink,
    ...colProps
  }) => {
    const { lang, preferences } = usePage().props;
    const { t } = useLaravelReactI18n();
    const value = row[name];
    const { can, canGlobal } = usePermission(row?.thisModel);
    let valueCell = "";
    switch (type) {
      case "image": {
        const name = convertTemplateLink(row);
        const alias = name
          .split(" ")
          .slice(0, 2)
          .map((n) => n.charAt(0))
          .join("");
        return (
          <Avatar className="w-full h-auto border rounded-xl aspect-square max-w-16 group">
            {value && (
              <AvatarImage
                src={resolveImageSrc(value)}
                alt={name}
                className=" transition-[filter]"
              />
            )}
            <AvatarFallback className="rounded-lg flex!">
              <p className="w-full font-semibold text-center text-muted-foreground text-3xl transition-[filter]">
                {alias}
              </p>
            </AvatarFallback>
          </Avatar>
        );
      }
      case "boolean":
        return (
          <span className="text-center">
            <Checkbox readOnly checked={value} className="cursor-default" />
          </span>
        );
      case "formStatus":
      case "formStatuses": {
        const newValue = row?.appendStatus;
        return (
          <div
            className={cn(
              newValue.length > 1
                ? "flex gap-x-1 gap-y-1 flex-wrap w-full"
                : "text-center",
            )}
          >
            {newValue.map((status, idx) => (
              <BadgeStatus
                className="text-xs py-0.5 px-2"
                key={idx}
                status={status}
              />
            ))}
          </div>
        );
      }
      case "date":
      case "time":
      case "datetime":
        if (!value) {
          valueCell = null;
        } else {
          valueCell = format(
            new TZDate(value),
            type == "date" ? "PPP" : type == "time" ? "pp" : "PPPpp",
            {
              locale: getLocaleDate(lang),
            },
          );
        }
        break;
      case "relation":
        valueCell = convertTemplateLink(value);
        break;
      case "html":
        return (
          <span
            className="[&_p]:inline [&_p]:m-0"
            dangerouslySetInnerHTML={{ __html: value ?? "" }}
          />
        );
      case "mixed":
      case "json":
      case "relations":
        return;
      case "string":
        if (!value) {
          valueCell = null;
        }
        valueCell = value
          ? valueTrans
            ? t(`${valueTrans}.${value?.toString()}`)
            : parse
              ? (parse[value?.toString()] ?? "")
              : value
          : "";
        break;
      case "number":
      case "currency": {
        if (value == null || value === "") {
          valueCell = "";
          break;
        }
        // Currency: precedence colProps.currencyCode -> row.currency -> default.
        // Symbol diambil langsung dari object currency (dikirim backend), tanpa fetch.
        let prefix = "";
        if (type === "currency") {
          const currencySource =
            colProps?.currencyCode ?? row?.currency ?? null;
          const symbol =
            typeof currencySource === "object" ? currencySource?.symbol : null;
          prefix = symbol ? `${symbol} ` : "";
        }
        // decimalScale/format: colProps bila ada, jika tidak fallback ke
        // preferences.default_number_format.
        const formatted = formatNumber(value, {
          numberFormat:
            colProps?.numberFormat ?? preferences?.default_number_format,
          decimalScale: colProps?.decimalScale,
          groupSeparator: colProps?.groupSeparator,
          decimalSeparator: colProps?.decimalSeparator,
          prefix,
        });
        valueCell = formatted === "" ? value : formatted;
        break;
      }
      default:
        valueCell = value;
    }
    if (typeof cell == "function") {
      const child = cell({
        dataRow: row,
        valueCell,
      });
      if (child) {
        return cloneElement(child, {
          ...child.props,
          className: cn(child.props.className, cellWrapClassName(type)),
        });
      }
    }
    if (isLink && route && can("read", { user_id: row?.created_by_id })) {
      return (
        <Link
          className={cn(
            "text-blue-800 dark:text-blue-200 hover:underline",
            cellWrapClassName(type),
          )}
          href={window.route(route ?? "", row[primaryKey] ?? "")}
        >
          {valueCell}
        </Link>
      );
    } else if (
      type == "relation" &&
      route &&
      !colProps?.disabledNavigation &&
      (colProps.signedRouteKey ||
        colProps.forceNavigation ||
        canGlobal(value?.thisModel, "read", {
          user_id: value?.created_by_id,
        }))
    ) {
      return (
        <Link
          href={
            value[colProps.signedRouteKey] ??
            window.route(
              value?.["route"] ? value?.["route"] + ".show" : (route ?? ""),
              value?.[primaryKey] ?? "",
            )
          }
          className={cn(
            "text-blue-800 dark:text-blue-200 hover:underline",
            cellWrapClassName(type),
          )}
        >
          {valueCell}
        </Link>
      );
    }
    return <span className={cellWrapClassName(type)}>{valueCell}</span>;
  },
);
Cell.displayName = "TableCell";
// Satu baris data tabel (`<tr>`): checkbox pilih, kolom aksi, lalu sel per kolom
// tampil. Diekstrak dari Table2 supaya dipakai jalur flat DAN pohon grup
// (spec datatable2-group-tree, task 7.1) dgn DOM yang identik.
export const TableRow = memo(function TableRow({
  row,
  selectable,
  actions,
  showedColumns,
  onRowClick,
  onCheck,
}) {
  return (
    <tr
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      className={cn(onRowClick && "cursor-pointer hover:bg-accent/50")}
    >
      {selectable && (
        <td className="py-2! px-2! items-center">
          <Checkbox
            checked={row.isSelected ?? false}
            onCheckedChange={(check) => onCheck(row, check)}
          />
        </td>
      )}
      {actions && (
        <td className="w-full flex flex-row! items-center gap-x-2 border-r border-muted-foreground/15">
          {actions({ dataRow: row })}
        </td>
      )}
      {showedColumns.map(({ type, name, parse, valueTrans, ...colProps }) => {
        return (
          <td key={name} className="border-r border-muted-foreground/15">
            <Cell
              row={row}
              type={type}
              name={name}
              parse={parse}
              valueTrans={valueTrans}
              {...colProps}
            />
          </td>
        );
      })}
    </tr>
  );
});
const Table2 = forwardRef(function Table2(
  {
    className,
    selectable,
    actions,
    columns: headers,
    freezeColumn = 0,
    onOptionsChanged,
    options: initialOptions = {},
    data: initialData = [],
    setSort,
    resetSorting,
    reload,
    isDynamicData,
    isLoading,
    persistColumns = true,
    onRowClick,
    // Pohon grup (spec datatable2-group-tree): { levels, aggregates, baseParams,
    // version, resetKey, pathname? } -- `data` = deskriptor grup level-0. Tanpa
    // prop ini Table2 merender daftar baris flat (tak berubah).
    group,
  },
  ref,
) {
  // Skip baca/tulis cookie kolom bila data dinamis (dikelola parent) ATAU
  // persistColumns dimatikan (mis. Table2 dibungkus Dialog — agar perubahan
  // kolomnya tidak menimpa preferensi cookie tabel halaman).
  const skipCookie = isDynamicData || !persistColumns;
  const { t } = useLaravelReactI18n();
  const [data, setData] = useState(initialData);
  useDidMountEffect(() => {
    setData(initialData);
  }, [initialData]);
  const [getRef, setRef] = useDynamicRefs();
  const [_options, _setOptions] = useState({
    page: 1,
    sort: {
      key: null,
      order: null,
    },
    search: {},
  });
  const options = initialOptions ?? _options;
  const setOptions = React.useCallback(
    (value) => {
      const optionsState = typeof value === "function" ? value(options) : value;
      if (onOptionsChanged) {
        onOptionsChanged(optionsState);
      } else {
        _setOptions(optionsState);
      }
    },
    [initialOptions, _options],
  );
  useImperativeHandle(
    ref,
    () => ({
      getSelectedItem() {
        return data.filter((x) => x.isSelected);
      },
    }),
    [data],
  );

  const minCellWidth = MIN_COLUMN_WIDTH;

  // const [tableHeight, setTableHeight] = useState("auto");
  const [activeIndex, setActiveIndex] = useState(null);
  const tableElement = useRef(null);
  // Snapshot size terbaru selama resize drag (lihat mouseMove) -- di-commit
  // ke state columns sekali saat mouseUp, bukan tiap gerak mouse (mahal).
  const pendingResizeRef = useRef(null);
  // Throttle mouseMove ke max 1x per animation frame: native mousemove bisa
  // fire puluhan kali/detik, tiap event asli berat (baca offsetWidth semua
  // kolom shown + tulis DOM) -- simpan event terbaru, proses sekali per rAF.
  const latestMouseMoveEventRef = useRef(null);
  const resizeRafIdRef = useRef(null);
  const [columns, setColumns] = useState(createHeaders(headers, skipCookie));
  const [openColumnsFilter, setOpenColumnsFilter] = useState(false);
  useDidMountEffect(() => {
    setColumns(createHeaders(headers, skipCookie));
  }, [headers]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      // Require the mouse to move by 10 pixels before activating
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      // Press delay of 250ms, with tolerance of 5px of movement
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    // useSensor(KeyboardSensor, {
    //   coordinateGetter: sortableKeyboardCoordinates,
    // }),
  );
  // useDidMountEffect(() => {
  //   saveToLocalStorage(
  //     `${DATATABLE_COLUMNS_KEY}_${window.location.pathname}`,
  //     columns.map((x) => ({ name: x.name, show: x.show })),
  //     DATATABLE_COLUMNS_EXPIRED,
  //   );
  // }, [columns]);
  const mergeColumns = useCallback((columns, showColumns) => {
    // Map lookup O(1) per kolom -- sebelumnya nested loop O(n*m), dipanggil
    // tiap handleDragOver fire (tiap px pointer lewat kolom lain saat drag).
    const orderByName = new Map(
      showColumns.map((col, index) => [col.name, index]),
    );
    return columns.map((col) => {
      const order = orderByName.get(col.name);
      return order === undefined ? col : { ...col, order };
    });
  }, []);
  function handleDragOver(event) {
    const { active, over } = event;

    if (active.id !== over.id) {
      setColumns((items) => {
        const showColumn = items
          .filter((x) => x.show)
          .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
        const newItems = showColumn.map((x) => x.name);

        const newIndex = newItems.indexOf(over.id);
        if (newIndex < freezeColumn) return items;

        const oldIndex = newItems.indexOf(active.id);
        const newColumn = arrayMove(showColumn, oldIndex, newIndex);
        tableElement.current.style.gridTemplateColumns = `${selectable ? "max-content" : ""} ${actions ? "max-content" : ""}  ${[
          ...newColumn,
        ]
          .map((x) => x.size)
          .join(" ")}`;

        return mergeColumns(items, newColumn);
      });
    }
  }

  // useEffect(() => {
  //   setTableHeight(tableElement.current.offsetHeight);
  // }, [tableElement]);

  const mouseDown = (index) => {
    setActiveIndex(index);
  };
  const getShowedColumns = useCallback((columns) => {
    const newCols = [];
    if (!Array.isArray(columns)) {
      columns = Object.values(columns);
    }
    columns.forEach((col) => {
      if (!col.show) return;
      if (col.type == "relations" || col.type == "mixed" || col.type == "json")
        return;
      if (col.type == "relation" && col.columns) {
        newCols.push(...getShowedColumns(col.columns));
      }
      newCols.push(col);
    });
    return newCols;
  }, []);
  const showedColumns = useMemo(() => {
    return getShowedColumns(columns).sort(
      (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
    );
  }, [columns]);

  useEffect(() => {
    if (skipCookie) return;
    const newShowedColumns = {};
    showedColumns.forEach((col, index) => {
      newShowedColumns[col.name] = {
        size: col.size,
        order: index,
      };
    });
    // Nama cookie unik per-path (suffix path ter-sanitize) → isolasi antar-halaman
    // tanpa bergantung path-scoping yang rapuh di sebagian browser. path:"/" agar
    // cookie pasti terkirim ke request halaman ybs (nama yang membedakan, bukan path).
    setCookie(
      datatableColumnsCookieKey(window.location.pathname),
      JSON.stringify(newShowedColumns),
      {
        days: DATATABLE_COLUMNS_EXPIRED,
        path: "/",
        sameSite: "lax",
      },
    );
  }, [showedColumns]);
  // Tinggi baris header kolom TIDAK LAGI konstan sejak header boleh wrap
  // (revisi wrap sel, gantikan running-text/truncate) -- header panjang di
  // kolom sempit bisa jadi 2-4 baris. Header grup sticky (GroupHeaderRow)
  // butuh nilai ini sbg `top` supaya nempel tepat di bawah header kolom --
  // diekspos lewat CSS var (bukan prop drilling) krn GroupHeaderRow ada di
  // subtree GroupTree yg terpisah dari <thead> ini. `thead`/`tr` sendiri =
  // `display:contents` (table.css) -> tak punya box utk di-observe; observe
  // SEMUA `th` (bukan cuma 1, grid stretch ternyata TAK selalu bisa
  // diandalkan konsisten dari 1 sel) & ambil TINGGI TERBESAR.
  //
  // Deps `[selectable, actions, showedColumns]` (bukan `[]`/tiap render):
  // versi awal pakai NO-DEPS (re-observe tiap render) & TERBUKTI cacat lewat
  // verifikasi browser -- var macet di nilai lama (48px) walau tinggi
  // sungguhan sudah 65px, krn observer lama ke-disconnect sebelum sempat
  // deliver notifikasi awal saat render beruntun (mis. toggle grup + reload
  // data). Effect ini hanya perlu re-attach saat SET th BENAR2 berubah
  // (kolom show/reorder), observer sendiri yg mendeteksi resize (wrap
  // berubah krn lebar kolom di-resize user, dst) tanpa perlu re-run effect.
  useEffect(() => {
    const table = tableElement.current;
    const headerCells = table ? [...table.querySelectorAll("thead th")] : [];
    if (
      !table ||
      headerCells.length === 0 ||
      typeof ResizeObserver === "undefined"
    ) {
      return undefined;
    }
    const updateStickyTop = () => {
      const tallest = Math.max(
        ...headerCells.map((el) => el.getBoundingClientRect().height),
      );
      table.style.setProperty("--group-sticky-top", `${Math.round(tallest)}px`);
    };
    const observer = new ResizeObserver(updateStickyTop);
    headerCells.forEach((el) => observer.observe(el));
    updateStickyTop(); // nilai awal langsung -- jangan tunggu frame observer pertama
    return () => observer.disconnect();
  }, [selectable, actions, showedColumns]);
  const computeResizedColumns = useCallback(
    (e) => {
      const newColumns = Object.fromEntries(columns.map((x) => [x.name, x]));
      const gridColumns = showedColumns.map((col, i) => {
        const ref = getRef(`col.${col.name}`);
        if (i === activeIndex) {
          const width = e.clientX - ref?.current?.offsetLeft;

          if (width >= minCellWidth) {
            const size = `${width}px`;
            newColumns[col.name] = { ...col, size };
            return size;
          }
        }
        let size = "";
        if (i < activeIndex) {
          size = `${ref?.current?.offsetWidth}px`;
        } else {
          if (col.size?.startsWith("minmax")) {
            size = `minmax(${MIN_COLUMN_WIDTH}px, 1fr)`;
          } else if (col.size == "1fr" || col.size == "max-content") {
            size = col.size;
          } else {
            size = `${ref?.current?.offsetWidth}px`;
          }
        }

        newColumns[col.name] = { ...col, size };
        return size;
      });

      pendingResizeRef.current = newColumns;
      tableElement.current.style.gridTemplateColumns = `${selectable ? "max-content" : ""} ${actions ? "max-content" : ""} ${gridColumns.join(
        " ",
      )}`;
    },
    [activeIndex, columns, minCellWidth],
  );
  // Native mousemove bisa fire lebih sering dari refresh rate layar --
  // simpan event terbaru, jadwalkan proses berat (computeResizedColumns)
  // max 1x per animation frame lewat rAF, bukan tiap event mentah.
  const mouseMove = useCallback(
    (e) => {
      latestMouseMoveEventRef.current = e;
      if (resizeRafIdRef.current == null) {
        resizeRafIdRef.current = requestAnimationFrame(() => {
          resizeRafIdRef.current = null;
          if (latestMouseMoveEventRef.current) {
            computeResizedColumns(latestMouseMoveEventRef.current);
          }
        });
      }
    },
    [computeResizedColumns],
  );
  const resetSizeHeader = (index) => {
    // Sebelumnya: debounce(fn, 500)() bikin instance debounce baru tiap
    // panggilan (jadi percuma, tidak collapse apa pun) DAN setColumns(columns,
    // newColumns) -- useState setter cuma terima 1 argumen, newColumns (hasil
    // reset sebenarnya) diabaikan React, yang ke-commit cuma state lama.
    // Reset jadi tak pernah tersimpan ke state, sama seperti bug resize.
    const resized = {};
    const gridColumns = showedColumns.map((col, i) => {
      const size = i === index ? convertColWidth(col.width) : col.size;
      resized[col.name] = { ...col, size };
      return size;
    });

    setColumns((items) => items.map((col) => resized[col.name] ?? col));

    tableElement.current.style.gridTemplateColumns = `${selectable ? "max-content" : ""} ${actions ? "max-content" : ""} ${gridColumns.join(
      " ",
    )}`;
  };

  const removeListeners = useCallback(() => {
    window.removeEventListener("mousemove", mouseMove);
    window.removeEventListener("mouseup", removeListeners);
    if (resizeRafIdRef.current != null) {
      cancelAnimationFrame(resizeRafIdRef.current);
      resizeRafIdRef.current = null;
    }
  }, [mouseMove]);

  const mouseUp = useCallback(() => {
    setActiveIndex(null);
    // Kalau masih ada rAF frame pending, proses posisi TERAKHIR secara
    // sinkron dulu -- tanpa ini, commit bisa "ketinggalan" 1 frame dari
    // posisi kursor saat mouseup (lihat computeResizedColumns/mouseMove).
    if (resizeRafIdRef.current != null) {
      cancelAnimationFrame(resizeRafIdRef.current);
      resizeRafIdRef.current = null;
      if (latestMouseMoveEventRef.current) {
        computeResizedColumns(latestMouseMoveEventRef.current);
      }
    }
    latestMouseMoveEventRef.current = null;
    // Selama drag, mouseMove cuma menulis langsung ke DOM (gridTemplateColumns)
    // demi performa -- tanpa commit ini, React tidak pernah tahu size barunya
    // dan re-render berikutnya (mis. drag-reorder kolom lain) akan menghitung
    // ulang gridTemplateColumns dari state lama, menimpa balik hasil resize.
    if (pendingResizeRef.current) {
      const resized = pendingResizeRef.current;
      pendingResizeRef.current = null;
      setColumns((items) => items.map((col) => resized[col.name] ?? col));
    }
    removeListeners();
  }, [setActiveIndex, removeListeners, computeResizedColumns]);

  useEffect(() => {
    if (activeIndex !== null) {
      window.addEventListener("mousemove", mouseMove);
      window.addEventListener("mouseup", mouseUp);
    }

    return () => {
      removeListeners();
    };
  }, [activeIndex, mouseMove, mouseUp, removeListeners]);

  const checkAll = (check) => {
    setData((data) => {
      const newData = data.map((x) => ({ ...x, isSelected: check }));
      return newData;
    });
  };

  // Pohon grup: render-prop utk GroupTree (desktop = <tr>/<td> di grid tabel).
  const rowSpan =
    showedColumns.length + (selectable ? 1 : 0) + (actions ? 1 : 0);
  const renderGroupHeader = useCallback(
    (args) => (
      <GroupHeaderRow
        {...args}
        columnMeta={headers?.[args.level?.column]}
        aggregates={group?.aggregates}
        showedColumns={showedColumns}
        selectable={selectable}
        actions={Boolean(actions)}
      />
    ),
    [headers, group?.aggregates, showedColumns, selectable, actions],
  );
  const renderGroupRow = useCallback(
    (row) => (
      <TableRow
        row={row}
        selectable={selectable}
        actions={actions}
        showedColumns={showedColumns}
        onRowClick={onRowClick}
        onCheck={() => {}}
      />
    ),
    [selectable, actions, showedColumns, onRowClick],
  );
  const renderGroupLoading = useCallback(
    ({ depth }) => <GroupNodeStatusRow depth={depth} colSpan={rowSpan} />,
    [rowSpan],
  );
  const renderGroupError = useCallback(
    ({ depth, onRetry }) => (
      <GroupNodeStatusRow
        depth={depth}
        colSpan={rowSpan}
        error
        onRetry={onRetry}
      />
    ),
    [rowSpan],
  );

  const checklist = (row, check) => {
    setData((data) => {
      const newData = data.map((x) => {
        if (x.id === row.id) {
          return { ...x, isSelected: check };
        }
        return x;
      });
      return newData;
    });
  };
  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <DndContext
        onDragOver={handleDragOver}
        sensors={sensors}
        collisionDetection={closestCenter}
      >
        <Dialog open={openColumnsFilter} onOpenChange={setOpenColumnsFilter}>
          <div className="flex flex-col flex-1 min-h-0">
            <table
              className="resizeable-table"
              ref={tableElement}
              style={{
                // Jalur flat: baris header, satu per baris data, lalu filler 1fr
                // yg menempel ke dasar. Pohon grup: jumlah baris DINAMIS (anak
                // node baru muncul saat dibuka) jadi tak bisa dihitung dari
                // data.length -- semua baris implisit `auto`, dipadatkan ke atas
                // (align-content: start; tanpa itu track auto melar mengisi tinggi).
                ...(group
                  ? { alignContent: "start" }
                  : {
                      gridTemplateRows: [
                        "auto",
                        ...data.map(() => "auto"),
                        "1fr",
                      ].join(" "),
                    }),
                gridTemplateColumns:
                  (selectable ? "max-content " : "") +
                  (actions ? "max-content " : "") +
                  showedColumns.map((col) => col.size).join(" "),
              }}
            >
              <thead>
                <tr>
                  <SortableContext
                    items={showedColumns.map((x) => x.name)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {selectable && (
                      <th className="py-2! px-2! items-center">
                        <Checkbox
                          checked={data.every((x) => x.isSelected ?? false)}
                          onCheckedChange={checkAll}
                        />
                      </th>
                    )}
                    {actions && (
                      <th className="py-2! px-2! pr-4! items-center border-r border-muted-foreground/15">
                        <span>{t("core.datatable.action")}</span>
                      </th>
                    )}
                    {showedColumns.map(({ resizeable, ...props }, i) => (
                      <Header
                        isEmpty={!data || data.length === 0}
                        setSort={setSort}
                        resetSorting={resetSorting}
                        options={options}
                        setOptions={setOptions}
                        freezeColumn={i < freezeColumn}
                        id={props.name}
                        key={props.name}
                        ref={setRef(`col.${props.name}`)}
                        resizeable={resizeable}
                        {...props}
                        onResize={() => mouseDown(i)}
                        onResetSize={() => resetSizeHeader(i)}
                        tableHeight={tableElement?.current?.offsetHeight}
                      />
                    ))}
                  </SortableContext>
                </tr>
              </thead>
              <tbody>
                {isLoading || !data || data.length === 0 ? (
                  <tr>
                    <td
                      className="border-b-0! items-center justify-center"
                      style={{
                        gridColumn: `span ${showedColumns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}`,
                      }}
                    >
                      {isLoading ? (
                        <div className="flex justify-center py-6 text-sm font-normal text-center text-foreground gap-x-4">
                          <LoadingIcon className="size-4" />
                          <span>{t("core.form.loading")} ...</span>
                        </div>
                      ) : !isDynamicData ? (
                        <NoDataImg className="w-full max-w-lg max-h-full" />
                      ) : (
                        <p className="text-muted-foreground">
                          {t("core.datatable.no_data")}
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  <>
                    {group ? (
                      <GroupTree
                        key={group.resetKey}
                        rootItems={data}
                        levels={group.levels}
                        baseParams={group.baseParams}
                        pathname={group.pathname}
                        version={group.version}
                        subLevelVersion={group.subLevelVersion}
                        fetcher={group.fetcher}
                        infinite={group.infinite}
                        renderGroupHeader={renderGroupHeader}
                        renderRow={renderGroupRow}
                        renderLoading={renderGroupLoading}
                        renderError={renderGroupError}
                      />
                    ) : (
                      data.map((row, index) => (
                        <TableRow
                          key={index}
                          row={row}
                          selectable={selectable}
                          actions={actions}
                          showedColumns={showedColumns}
                          onRowClick={onRowClick}
                          onCheck={checklist}
                        />
                      ))
                    )}
                    {!group && (
                      <tr>
                        <td
                          className="border-b-0! items-center justify-center row-auto h-full z-2 relative bg-background"
                          style={{
                            gridColumn: `span ${showedColumns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}`,
                          }}
                        />
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
          <ColumnsFilter
            columns={columns}
            open={openColumnsFilter}
            onApply={(val) => {
              if (!skipCookie) {
                const newShowedColumns = {};
                getShowedColumns(val)
                  .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
                  .forEach((col, index) => {
                    newShowedColumns[col.name] = {
                      size: col.size,
                      order: index,
                    };
                  });
                setCookie(
                  datatableColumnsCookieKey(window.location.pathname),
                  JSON.stringify(newShowedColumns),
                  {
                    days: DATATABLE_COLUMNS_EXPIRED,
                    path: "/",
                    sameSite: "lax",
                  },
                );
              }
              setColumns(val);
              reload?.(val);
              setOpenColumnsFilter(false);
            }}
            onReset={() => {
              if (!skipCookie) {
                removeCookie(
                  datatableColumnsCookieKey(window.location.pathname),
                  "/",
                );
              }
              router.reload();
              setOpenColumnsFilter(false);
            }}
          />
        </Dialog>
      </DndContext>
    </div>
  );
});

export default memo(Table2);
