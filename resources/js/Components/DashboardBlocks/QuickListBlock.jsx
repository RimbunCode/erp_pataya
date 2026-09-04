import { useEffect, useMemo, useRef, useState } from "react";
import { flattenFilters } from "@/Hooks/useNestedFilters";

import BlockDescriptionTooltip from "@/Components/DashboardBlocks/BlockDescriptionTooltip";
import BlockEditDialog from "@/Components/DashboardBlocks/BlockEditDialog";
import ColumnOrderPicker, {
  columnLabel,
  isSelectableColumn,
} from "@/Components/DashboardBlocks/ColumnOrderPicker";
import FilterTable2 from "@/Components/Table/Filter/FilterTable2";
import IconPicker from "@/Components/IconPicker";
import { Input } from "@/Components/ui/input";
import LoadingIcon from "@/Components/LoadingIcon";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import Pagination from "@/Components/Table/Pagination";
import Select from "@/Components/Select";
import TiptapEditor from "@/Components/TiptapEditor";
import { Cell } from "@/Components/Table/Table2";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import { resolveIcon } from "@/lib/deskIcons";
import axios from "axios";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { richTextValue } from "@/lib/richText";
import useInViewport from "@/Hooks/useInViewport";

// Optimasi dashboard: metadata kolom model (dari endpoint model.columns)
// nyaris tidak pernah berubah dalam satu sesi browser — tanpa cache ini,
// tiap QuickListBlock yang mount (dan tiap kali dialog edit dibuka) fetch
// ulang endpoint yang sama walau modelClass-nya sama dgn block lain di
// Desk yang sama. Cache module-level (bukan React state) supaya nilainya
// SHARED lintas instance komponen, plus `inflight` men-dedupe request
// yang nembak bersamaan (mis. 3 QuickList dgn model sama mount serentak
// saat Dashboard pertama kali dibuka -> cukup 1 request, bukan 3).
const modelColumnsCache = new Map();
const modelColumnsInflight = new Map();

// Test-only: cache module-level di atas SENGAJA hidup selintas seluruh proses
// (bukan per-render) — tanpa reset ini, test file yang jalankan banyak
// `it()` dgn modelClass sama tapi payload columns BEDA (mis. validate()
// kolom kosong vs terisi) akan saling bocor lintas test lewat cache.
export function __resetModelColumnsCacheForTests() {
  modelColumnsCache.clear();
  modelColumnsInflight.clear();
}

function fetchModelColumns(modelClass) {
  if (modelColumnsCache.has(modelClass)) {
    return Promise.resolve(modelColumnsCache.get(modelClass));
  }
  if (modelColumnsInflight.has(modelClass)) {
    return modelColumnsInflight.get(modelClass);
  }

  const promise = axios
    .get(window.route("model.columns", { model: modelClass }))
    .then((res) => {
      const data = {
        columns: res.data?.columns ?? [],
        route: res.data?.route ?? null,
      };
      modelColumnsCache.set(modelClass, data);

      return data;
    })
    .finally(() => {
      modelColumnsInflight.delete(modelClass);
    });

  modelColumnsInflight.set(modelClass, promise);

  return promise;
}

// Hook lokal — fetch kolom model via endpoint model.columns (sama dipakai
// Settings/Widget/Form.jsx). DIPISAH dari komponen utama krn dibutuhkan
// dua tempat dengan sumber modelClass BERBEDA: body block (config.model_
// class, data tersimpan) vs form Dialog (draft.model_class, BELUM
// tersimpan) — bug ditemukan: sebelumnya HANYA di-fetch berdasar
// config.model_class, jadi checklist kolom/opsi sort TIDAK PERNAH muncul
// saat user baru pertama kali memilih Model DI DALAM Dialog (draft belum
// di-Terapkan, config lama masih kosong). `isLoading` ditambahkan supaya
// Dialog bisa kasih indikator visual saat fetch masih berjalan — tanpa
// ini, jeda antara pilih Model & checklist kolom muncul terlihat seperti
// pilihan tidak tersimpan (feedback user).
function useModelColumns(modelClass) {
  // `columns` & `route` (slug route model, mis. "items" — dipakai bangun
  // href navigasi kolom isLink: `${route}.show`) DISATUKAN dalam SATU
  // state supaya keduanya SELALU update bersamaan/atomik — dua state
  // terpisah rawan salah satunya "telat" satu render dibanding lainnya,
  // persis penyebab bug reset-columns di bawah.
  const cached = modelClass ? modelColumnsCache.get(modelClass) : undefined;
  const [state, setState] = useState(cached ?? { columns: [], route: null });
  const [isLoading, setIsLoading] = useState(!cached && !!modelClass);

  // Bug ditemukan: reset state di dalam useEffect (di bawah) SELALU telat
  // satu render dibanding `modelClass` yang sudah berubah lebih dulu (via
  // patchDraft di handler pilih Model) — dalam window renders itu,
  // consumer (auto-fill QuickListForm) sempat baca `columns` MASIH kolom
  // MODEL LAMA sambil `draft.model_class` SUDAH model baru, lolos guard
  // "sudah siap" secara keliru. Reset SAAT RENDER (bukan di effect, pola
  // resmi React "adjusting state when a prop changes") membuat React
  // langsung re-render dgn `columns=[]` SEBELUM efek manapun (termasuk
  // effect QuickListForm) sempat baca versi stale-nya. Kalau model baru
  // SUDAH ada di cache, langsung pakai itu (bukan `[]`) — hindari kedipan
  // "Memuat kolom..." percuma utk model yang sudah pernah di-fetch.
  const lastModelClassRef = useRef(modelClass);
  if (lastModelClassRef.current !== modelClass) {
    lastModelClassRef.current = modelClass;
    const nowCached = modelClass
      ? modelColumnsCache.get(modelClass)
      : undefined;
    setState(nowCached ?? { columns: [], route: null });
    setIsLoading(!nowCached && !!modelClass);
  }

  useEffect(() => {
    if (!modelClass) {
      setState({ columns: [], route: null });
      setIsLoading(false);
      return;
    }
    if (modelColumnsCache.has(modelClass)) {
      setState(modelColumnsCache.get(modelClass));
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchModelColumns(modelClass)
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState({ columns: [], route: null });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modelClass]);

  return { columns: state.columns, route: state.route, isLoading };
}

// Requirement 2.7, 2.8, 2.12: pilih model (izin select via
// PermissionLinkModel — sama pola Widget/Form.jsx), fetch dokumen via
// dashboard.quickList (guard kolom Schema::hasColumn + relasi
// permission-checked di backend). Feedback user (revisi besar):
// - shrink/extend SEKARANG 2 nilai diskrit half/full (BUKAN kelipatan 3
//   ala block lain — Quick List tabular, cuma masuk akal setengah/penuh)
// - kolom yang ditampilkan bisa dipilih via checklist (config.columns),
//   render per-tipe (Cell, sama dgn Table2) termasuk kolom relasi
// - filter pakai FilterTable2 (pola UI sama persis DataTable2). config.
//   filters DISIMPAN sbg TREE ({root:{...}}) supaya FilterTable2 bisa
//   re-load initialFilters — tapi payload ke endpoint quickList di-
//   FLATTEN dulu (flattenFilters, helper yang SAMA dipakai FilterTable2
//   sendiri) jadi array [[field,operator,value],...] AND-only sederhana.
//   Quick List sengaja TIDAK dukung nested group/OR kompleks di backend
//   — widget kecil dashboard, bukan listing DataTable penuh.
// - pagination server-side: `limit` config = ukuran per halaman.
export default function QuickListBlock({
  block,
  canEdit,
  onUpdate,
  onDelete,
  editOpen,
  onEditOpenChange,
}) {
  const config = block.config ?? {};
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ total: 0, lastPage: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const modelClass = config.model_class;
  // Opsi C optimasi dashboard: tunda POST dashboard.quickList sampai block
  // ini mendekati viewport -- ref nempel di root <div> (return di bawah),
  // yang SELALU ter-render terlepas dari state loading/model belum dipilih.
  const containerRef = useRef(null);
  const isInView = useInViewport(containerRef);
  const {
    columns: savedColumns,
    route: modelRoute,
    isLoading: isLoadingColumns,
  } = useModelColumns(modelClass);
  const { t } = useLaravelReactI18n();

  // Bug ditemukan: dulu request FETCH kirim `config.columns` MENTAH (bisa
  // kosong/null), sedangkan header tabel dirender dari `visibleColumns`
  // (fallback bila belum ada yang dipilih) — akibatnya header nampilin
  // kolom tapi backend cuma balikin primary key (fallback backend sendiri
  // saat `columns` kosong), jadi data selalu kosong utk Quick List yang
  // belum pernah diatur kolomnya. `visibleColumns` SEKARANG satu-satunya
  // sumber kebenaran, dipakai baik utk header maupun payload.
  //
  // Feedback user: default kolom (saat draft.columns belum diisi) BUKAN
  // "3 kolom pertama" (arbitrer) — ikuti `show:true` di configColumns
  // model, pola SAMA dgn DataTableColumnSelector::effectiveVisibleHeads()
  // yang dipakai listing DataTable lain di app ini (kurasi kolom default
  // sudah jadi keputusan tiap model, bukan diterka dari urutan).
  const visibleColumns = config.columns?.length
    ? config.columns
    : savedColumns
        .filter(isSelectableColumn)
        .filter((c) => c.show === true)
        .map((c) => c.name);

  // Ganti model/filter/kolom/sort/limit → kembali ke halaman 1 (halaman
  // lama bisa saja sudah melewati total halaman baru).
  useEffect(() => {
    setPage(1);
  }, [
    modelClass,
    config.filters,
    visibleColumns.join(","),
    config.sort_by,
    config.sort_direction,
    config.limit,
  ]);

  useEffect(() => {
    if (!modelClass || visibleColumns.length === 0 || !isInView) {
      setItems([]);
      setPageMeta({ total: 0, lastPage: 1 });
      return;
    }
    const flatFilters = config.filters?.root
      ? flattenFilters(
          config.filters.root.c ?? config.filters.root.children ?? {},
        )
      : [];
    let cancelled = false;
    setIsLoading(true);
    axios
      // Feedback user: model class di BODY (bukan URL segment) — pola
      // umum REST utk data request POST, route tak perlu lagi whitelist
      // regex `.*` khusus menampung backslash namespace PHP.
      .post(window.route("dashboard.quickList"), {
        model: modelClass,
        filters: flatFilters,
        columns: visibleColumns,
        sort_by: config.sort_by ?? null,
        sort_direction: config.sort_direction ?? "desc",
        limit: config.limit ?? 5,
        page,
      })
      .then((res) => {
        if (cancelled) return;
        // Feedback user: kolom isLink harus bisa redirect ke halaman show
        // (dgn permission-check), sama seperti Table2 — Cell butuh
        // `row.thisModel` (nama class model) utk usePermission(). Backend
        // sengaja TIDAK mengirim ini (baris ROOT di-strip appends demi
        // whitelist kolom ketat), tapi nilainya cuma nama class model —
        // metadata, SAMA PERSIS dgn `modelClass` yang FE kirim sendiri di
        // request ini, bukan data sensitif yang perlu izin server.
        const rows = (res.data?.data ?? []).map((row) => ({
          ...row,
          thisModel: modelClass,
        }));
        setItems(rows);
        setPageMeta({
          total: res.data?.total ?? 0,
          lastPage: res.data?.last_page ?? 1,
          currentPage: res.data?.current_page ?? page,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setPageMeta({ total: 0, lastPage: 1 });
        toast.error("Gagal memuat data Quick List.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    modelClass,
    config.filters,
    visibleColumns.join(","),
    config.sort_by,
    config.sort_direction,
    config.limit,
    page,
    isInView,
  ]);

  const columnByName = useMemo(
    () => new Map(savedColumns.map((c) => [c.name, c])),
    [savedColumns],
  );

  return (
    // h-full: block mengisi tinggi baris grid (SortableBlock sudah
    // meregangkan cell-nya via stretchToRow di DashboardCanvas) supaya
    // sejajar dengan block di sebelahnya — pola SAMA dgn LinkCardBlock.
    // Feedback user: dua Quick List bersebelahan kelihatan janggal kalau
    // tingginya beda-beda ikut jumlah baris data masing-masing.
    <div
      ref={containerRef}
      className="flex h-full flex-col rounded-lg border p-3"
    >
      {/* Feedback user: Quick List kini punya identitas sendiri — label
          (wajib), ikon opsional, dan deskripsi opsional sebagai tooltip,
          pola sama dengan Link Card. */}
      <div className="mb-2 flex items-center gap-2">
        {config.icon && (
          <span className="flex size-6 items-center justify-center [&>svg]:size-4">
            {resolveIcon(config.icon)}
          </span>
        )}
        <span className="font-medium">{config.label || "Quick List"}</span>
        <BlockDescriptionTooltip description={config.description} />
      </div>

      {!modelClass ? (
        <div className="text-sm text-muted-foreground">
          Belum ada Model dipilih.
        </div>
      ) : (
        <>
          {/* flex-1 + min-h-0: tabel mengisi SISA tinggi block (bukan lagi
              max-h-80 tetap) — min-h-0 wajib supaya overflow-y-auto flex
              child benar-benar bisa scroll, bukan ikut memanjangkan block
              (gotcha flexbox: default min-height:auto flex item). */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {/* Label kolom mengikuti terjemahan yang sama dengan
                      tabel lain (title / titleTrans), bukan nama kolom mentah. */}
                  {visibleColumns.map((col) => (
                    <th key={col} className="px-2 py-1.5 font-medium">
                      {columnLabel(columnByName.get(col) ?? { name: col }, t)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Bug FATAL ditemukan: dulu body baris bisa render SEBELUM
                    metadata kolom (savedColumns) selesai fetch — kolom
                    bertipe relasi jatuh ke fallback `type:"string"` yg
                    salah, lalu Cell coba render OBJEK relasi mentah sbg
                    children React → crash ("Minified React error #31").
                    isLoadingColumns SEKARANG ikut menahan render baris,
                    sama seperti isLoading (fetch data) — dua-duanya harus
                    selesai sebelum Cell dipanggil dengan metadata kolom
                    yang benar. `!isInView` (opsi C, lazy-load) ikut sama:
                    fetch belum SEMPAT jalan sampai block masuk viewport,
                    jangan sampai kelihatan seperti "Tidak ada data." dulu. */}
                {isLoading || isLoadingColumns || !isInView ? (
                  <tr>
                    <td colSpan={visibleColumns.length || 1} className="py-6">
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <LoadingIcon className="size-4" />
                        <span>Memuat data...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length || 1}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  // key: primary key TIDAK selalu bernama "id" (mis. countries),
                  // jadi fallback ke index — backend sudah menjamin urutan
                  // baris stabil lewat orderBy.
                  items.map((item, rowIndex) => (
                    <tr
                      key={item.id ?? rowIndex}
                      className="border-b last:border-0 hover:bg-muted/40"
                    >
                      {visibleColumns.map((colName) => {
                        const { type, name, parse, valueTrans, ...colProps } =
                          columnByName.get(colName) ?? {
                            name: colName,
                            type: "string",
                          };
                        // Kolom fisik isLink (mis. "code") tidak bawa `route`
                        // sendiri dari backend (beda dgn kolom relasi yang
                        // sudah punya route spesifik) — pola sama DataTable2
                        // (getColumns(): route isLink = `${modelRoute}.show`),
                        // di sini modelRoute sumbernya field `route` respons
                        // model.columns (sudah bentuk jamak, tak perlu pluralize).
                        if (colProps.isLink && !colProps.route && modelRoute) {
                          colProps.route = `${modelRoute}.show`;
                        }

                        return (
                          <td key={colName} className="truncate px-2 py-1.5">
                            <Cell
                              row={item}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            className="mt-2"
            currentPage={pageMeta.currentPage ?? page}
            totalPages={pageMeta.lastPage}
            onPageChanged={setPage}
          />
        </>
      )}
      {canEdit && (
        <BlockEditDialog
          title="Edit Quick List"
          block={block}
          canEdit={canEdit}
          open={editOpen}
          onOpenChange={onEditOpenChange}
          isNew={block.isNew}
          onCancelNew={onDelete}
          validate={(draft) => {
            if (!draft.label?.trim()) return "Label wajib diisi.";
            if (!draft.model_class) return "Model wajib dipilih.";
            // Feedback user: kolom & urutan tidak lagi boleh kosong diam-diam
            // (dulu fallback runtime otomatis mengisi bila kosong) — sekarang
            // kolom default (show:true) & sort_by default (created_at)
            // di-auto-fill ke draft SEKALI saat model dipilih (lihat useEffect
            // di QuickListForm), tapi tetap WAJIB tervalidasi supaya model
            // tanpa kolom show:true/created_at memaksa user memilih manual.
            if (!draft.columns?.length)
              return "Pilih minimal satu kolom untuk ditampilkan.";
            if (!draft.sort_by) return "Urutkan berdasarkan wajib diisi.";

            return null;
          }}
          onSave={(draft) =>
            onUpdate({ ...block, config: draft, isNew: false })
          }
          renderForm={(draft, patchDraft) => (
            <QuickListForm draft={draft} patchDraft={patchDraft} />
          )}
        />
      )}
    </div>
  );
}

// Form Dialog dipisah jadi komponen sendiri SUPAYA useModelColumns bisa
// react ke draft.model_class (bukan config.model_class yang sudah
// tersimpan) — bug utama yang diperbaiki di sesi ini.
function QuickListForm({ draft, patchDraft }) {
  const { columns, isLoading: isLoadingColumns } = useModelColumns(
    draft.model_class,
  );
  const { t } = useLaravelReactI18n();
  // sort_by HANYA masuk akal utk kolom yang backend bisa ORDER BY —
  // kolom relasi/metadata sudah ditandai sortable:false di getColumns().
  const columnOptions = useMemo(
    () =>
      columns
        .filter(isSelectableColumn)
        .filter((c) => c.sortable !== false)
        .map((c) => ({ value: c.name, label: columnLabel(c, t) })),
    [columns, t],
  );

  // Feedback user: kolom & urutan default TIDAK BOLEH cuma fallback
  // runtime (dulu: tabel tampil kolom bawaan tapi picker/Select kelihatan
  // kosong — bingung, dan draft yang disimpan bisa kosong krn validate()
  // tidak mengeceknya). Sekali per model (ref-guarded, supaya tidak
  // menimpa pilihan manual user berikutnya), isi draft.columns dgn kolom
  // show:true (pola sama DataTableColumnSelector::effectiveVisibleHeads)
  // dan draft.sort_by dgn created_at BILA model punya kolom itu — kalau
  // tidak ada satupun, biarkan kosong supaya validate() memaksa user
  // memilih manual (bukan silently invalid).
  const autoFilledModelRef = useRef(null);
  useEffect(() => {
    if (!draft.model_class || columns.length === 0) return;
    if (autoFilledModelRef.current === draft.model_class) return;
    autoFilledModelRef.current = draft.model_class;

    const patch = {};
    if (!draft.columns?.length) {
      // Feedback user: urutan kolom default ikut property `order` di
      // configColumns model (mis. Country: code=0, name=1, lang_code=2) —
      // getColumns() BACKEND selalu usort() by NAME alfabetis (dipakai
      // konsumen lain: picker checkbox, sort_by dropdown, dst), jadi
      // pengurutan `order` di sini SENGAJA hanya utk daftar default ini,
      // bukan mengubah urutan global getColumns().
      const defaults = columns
        .filter(isSelectableColumn)
        .filter((c) => c.show === true)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((c) => c.name);
      if (defaults.length) patch.columns = defaults;
    }
    if (!draft.sort_by && columns.some((c) => c.name === "created_at")) {
      patch.sort_by = "created_at";
    }
    if (Object.keys(patch).length > 0) patchDraft(patch);
  }, [draft.model_class, columns]);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Label</label>
        <Input
          value={draft.label ?? ""}
          onChange={(e) => patchDraft({ label: e.target.value })}
          placeholder="Label"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Icon <span className="text-muted-foreground">(opsional)</span>
        </label>
        <IconPicker
          value={draft.icon}
          onValueChange={(val) => patchDraft({ icon: val })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Deskripsi{" "}
          <span className="text-muted-foreground">
            (opsional, tampil sbg tooltip)
          </span>
        </label>
        <TiptapEditor
          value={richTextValue(draft.description)}
          onValueChange={(json, html) =>
            patchDraft({ description: { json, html } })
          }
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Model</label>
        {/* Bug: sebelumnya value direkonstruksi jadi {id, model} saja,
            sehingga LinkModel kehilangan data tampilannya dan field
            terlihat KOSONG walau model sudah dipilih. Simpan objek utuh
            (pola sama Settings/Widget/Form.jsx) — model_id/model_class
            tetap ikut disimpan karena dipakai query backend. */}
        <PermissionLinkModel
          value={draft.model ?? null}
          onValueChange={(val) => {
            // Bug: LinkModel memanggil onValueChange(null) saat TIDAK BISA
            // me-resolve tampilan nilai awal (mis. config lama yang cuma
            // menyimpan model_id/model_class tanpa objek Permission utuh).
            // Dulu callback ini langsung menimpa model_class jadi null,
            // sehingga membuka dialog saja sudah MENGHAPUS pilihan model —
            // bagian Kolom & Filter ikut hilang dan Terapkan tertahan
            // "Model wajib dipilih". Model wajib diisi, jadi null di sini
            // diperlakukan sebagai "tidak ada perubahan", bukan penghapusan.
            if (!val) return;

            patchDraft({
              model: val,
              model_id: val.id ?? null,
              model_class: val.model ?? null,
              columns: [],
            });
          }}
        />
      </div>

      {/* Feedback user: jeda fetch kolom setelah pilih Model tidak punya
          indikator visual — terlihat seperti pilihan tidak tersimpan. */}
      {draft.model_class && isLoadingColumns && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoadingIcon className="size-3" />
          <span>Memuat kolom model...</span>
        </div>
      )}

      {draft.model_class && !isLoadingColumns && columns.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Kolom ditampilkan</label>
          <ColumnOrderPicker
            columns={columns}
            value={draft.columns}
            onChange={(cols) => patchDraft({ columns: cols })}
          />
        </div>
      )}

      {draft.model_class && !isLoadingColumns && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Filter</label>
          <FilterTable2
            columns={columns}
            model={draft.model_class}
            initialFilters={draft.filters}
            onApply={(tree) => patchDraft({ filters: tree })}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Urutkan berdasarkan</label>
        <Select
          value={draft.sort_by}
          onValueChange={(val) => patchDraft({ sort_by: val })}
          options={columnOptions}
          placeholder="Urutkan berdasarkan"
          disabled={!draft.model_class}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Arah urutan</label>
        <Select
          value={draft.sort_direction ?? "desc"}
          onValueChange={(val) => patchDraft({ sort_direction: val })}
          options={[
            { value: "asc", label: "Naik" },
            { value: "desc", label: "Turun" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Jumlah per halaman</label>
        <Input
          type="number"
          min={1}
          max={20}
          value={draft.limit ?? 5}
          onChange={(e) => patchDraft({ limit: Number(e.target.value) || 5 })}
        />
      </div>
    </>
  );
}
