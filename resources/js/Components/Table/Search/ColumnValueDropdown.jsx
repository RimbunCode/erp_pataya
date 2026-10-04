// ColumnValueDropdown — isi dropdown mode value (opsi list/boolean, preset +
// saran tanggal, record relasi, "Diisi/Tidak diisi", widget kalender, legend)
// yang diekstrak dari `SearchBar.jsx` supaya dipakai BERSAMA Search Bar atas dan
// Sel Filter per kolom (spec datatable2-column-search-row, Requirement 10.2).
// Dibungkus pemanggil dengan <Command shouldFilter={false}> dan <PopoverContent>
// (cmdk butuh input sebagai keturunan DOM Command yang sama, lihat SearchBar).

import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/Components/ui/command";
import { MAX_DATE_VALUES } from "./columnSearch";
import { dateNoticeText, recordLabel } from "./valueInputUtils";
import { isStatusColumn } from "./searchChips";

import BadgeStatus from "@/Components/BadgeStatus";
import { DateSelector as ReuiDateSelector } from "@/Components/ui/date-selector";
import LoadingIcon from "@/Components/LoadingIcon";
import SearchLegend from "./SearchLegend";
import { cn } from "@/lib/utils";
import { highlightMatch } from "@/lib/highlightMatch";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * @param {object} p
 * @param {object} p.value controller `useColumnValueInput`
 * @param {object} p.legendCtx konteks `SearchLegend` (scope value)
 * @param {{show: boolean, sections: Array, onSelect: (item: object) => void}} [p.suggestions]
 *   saran mode key (hanya Search Bar atas); tanpa ini hanya daftar nilai
 * @returns {React.JSX.Element}
 */
export default function ColumnValueDropdown({ value, legendCtx, suggestions }) {
  const { t } = useLaravelReactI18n();
  const {
    addDateValues,
    dateParseCtx,
    datePresets,
    dateSuggestions,
    dateYearBounds,
    excludeMode,
    handleDatePickerChange,
    inputValue,
    isBooleanColumn,
    listUncheckedOptions,
    mode,
    optionClass,
    pickBooleanValue,
    pickListValue,
    pickRecord,
    pickSetOperator,
    relationSearch,
    relationUncheckedOptions,
    reuiDateI18n,
    reuiDateValue,
    searchText,
    setOptions,
    setValueError,
    setWidgetFocus,
    showHint,
    showRelationResults,
    showValueList,
    valueColumn,
    vmode,
    widgetPointerRef,
  } = value;
  const dateTwoColumn = mode === "value" && vmode === "date";

  return (
    <>
      {/* Requirement 29.1: indikator "Kecualikan" -- SEMUA
          tipe kolom mode value, bukan cuma list/relation
          (text/number sudah punya negasi lewat sintaks ketik
          `!`, ini cuma penegasan visual yg sama). */}
      {excludeMode && (
        <div className="px-2 py-1 text-xs font-medium text-destructive border-b">
          {t("core.datatable.search.exclude_badge")}
        </div>
      )}
      <div className={cn(dateTwoColumn && "md:flex md:items-stretch")}>
        <div className={cn("min-w-0", dateTwoColumn && "md:flex-1")}>
          {showRelationResults && relationSearch.loading && (
            <div className="flex items-center justify-center py-2 border-b">
              <LoadingIcon
                role="status"
                aria-label={t("core.datatable.search.applying")}
                className="size-4 text-muted-foreground"
              />
            </div>
          )}
          <CommandList onMouseDown={(e) => e.preventDefault()}>
            {/* Revisi 5: cmdk render <CommandEmpty> otomatis begitu
            0 CommandItem terdaftar -- SELAMA fetch relation
            masih pending, options masih [] (belum ada item),
            jadi "tidak ditemukan" nongol BARENGAN LoadingIcon
            (bug nyata, ketauan verifikasi visual). Sembunyikan
            eksplisit selama loading -- baru muncul kalau fetch
            BENAR-BENAR selesai dgn hasil kosong.
            Revisi 6 (Requirement 31): JUGA disembunyikan utk
            `showHint` (text/number) -- dropdown itu dibuka
            KHUSUS utk footer hint di bawah, bukan listing;
            "tidak ditemukan" di situ cuma pesan tak relevan. */}
            {!(showRelationResults && relationSearch.loading) && !showHint && (
              <CommandEmpty>{t("core.form.not_found")}</CommandEmpty>
            )}
            {suggestions?.show &&
              suggestions.sections.map((sec) => (
                <CommandGroup
                  key={sec.section}
                  heading={
                    sec.section !== "text"
                      ? t(`core.datatable.search.section.${sec.section}`)
                      : undefined
                  }
                >
                  {sec.items.map((item) => (
                    <CommandItem
                      key={item.key}
                      value={item.key}
                      onSelect={() => suggestions.onSelect(sec.section, item)}
                    >
                      {/* Dibungkus 1 <span> -- CommandItem ber-`gap-2`
                      flex, hasil highlightMatch (array node)
                      kalau langsung jadi children akan dianggap
                      flex-item TERPISAH & dapat gap visual di
                      antara <mark> & teks sisanya (bug nyata,
                      lihat screenshot verifikasi visual). */}
                      <span>
                        {item.prefix}
                        {item.badgeStatus !== undefined ? (
                          <BadgeStatus
                            status={item.badgeStatus}
                            label={highlightMatch(
                              item.label.slice(item.prefix?.length ?? 0),
                              inputValue,
                            )}
                            className="text-xs py-0.5 px-2"
                          />
                        ) : (
                          highlightMatch(
                            item.label.slice(item.prefix?.length ?? 0),
                            inputValue,
                          )
                        )}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            {/* Revisi 7 (Requirement 36.10): opsi list/boolean
            TANPA checkbox -- klik / Enter menambah chip; opsi
            yg sudah jadi chip tak ditampilkan lagi. */}
            {showValueList &&
              vmode === "list" &&
              listUncheckedOptions.map((opt) => (
                <CommandItem
                  key={`${opt.value}`}
                  value={`${opt.value}`}
                  onSelect={() =>
                    isBooleanColumn
                      ? pickBooleanValue(opt.value)
                      : pickListValue(opt.value)
                  }
                  className={optionClass}
                >
                  {isStatusColumn(valueColumn) ? (
                    <BadgeStatus
                      status={opt.value}
                      label={highlightMatch(opt.label, searchText)}
                      className="text-xs py-0.5 px-2"
                    />
                  ) : (
                    <span>{highlightMatch(opt.label, searchText)}</span>
                  )}
                </CommandItem>
              ))}
            {showValueList &&
              vmode === "date" &&
              datePresets.map((preset) => (
                <CommandItem
                  key={preset.key}
                  value={preset.key}
                  onSelect={() => addDateValues([preset.value])}
                  className={optionClass}
                >
                  <span>{highlightMatch(preset.label, searchText)}</span>
                </CommandItem>
              ))}
            {/* Requirement 30.5: token belum lengkap (tanpa tahun
            spesifik, mis. "Q2") -> kandidat tahun terdekat.
            Revisi 11: klik menambah chip (dropdown tetap
            terbuka), SAMA dgn preset. */}
            {showValueList &&
              vmode === "date" &&
              dateSuggestions.length > 0 && <CommandSeparator />}
            {showValueList &&
              vmode === "date" &&
              dateSuggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion.key}
                  value={suggestion.key}
                  onSelect={() => addDateValues([suggestion.value])}
                  className={optionClass}
                >
                  <span>{suggestion.label}</span>
                </CommandItem>
              ))}
            {/* Revisi 7 (Requirement 36.10): record relation tanpa
            checkbox -- klik / Enter menambah chip; record yg
            sudah jadi chip tak ditampilkan lagi (chip persist
            walau kata kunci berubah, Requirement 28). */}
            {showRelationResults &&
              relationUncheckedOptions.map((record) => (
                <CommandItem
                  key={`${record.id}`}
                  value={`${record.id}`}
                  onSelect={() => pickRecord(record)}
                  className={optionClass}
                >
                  <span>{recordLabel(record)}</span>
                </CommandItem>
              ))}
            {/* `CommandEmpty` cmdk tak pernah tampil selama opsi
            Diisi/Tidak diisi ada -- pesan "tidak ditemukan"
            dirender eksplisit HANYA utk relation tanpa ketikan
            & tanpa record sama sekali. Sejak Revisi 15 TIDAK
            muncul bila ada ketikan: opsi Diisi/Tidak diisi yg
            tampil itu SUDAH cocok dgn ketikan (di-filter
            `setOptions`), jadi "tidak ada hasil" di atasnya
            kontradiktif; bila ketikan tak cocok apa pun,
            `setOptions` kosong & CommandEmpty bawaan yg muncul.
            List: nilai kosong krn semua sudah jadi chip bukan
            "tidak ditemukan". */}
            {setOptions.length > 0 &&
              showRelationResults &&
              !relationSearch.loading &&
              relationUncheckedOptions.length === 0 &&
              !searchText.trim() && (
                <div className="py-2 text-center text-sm text-muted-foreground">
                  {t("core.form.not_found")}
                </div>
              )}
            {/* Revisi 8 (Requirement 40): "Diisi"/"Tidak diisi"
            utk SEMUA tipe kolom, di bawah daftar nilai. */}
            {mode === "value" && setOptions.length > 0 && (
              <>
                {((vmode === "list" && listUncheckedOptions.length > 0) ||
                  (vmode === "relation" &&
                    relationUncheckedOptions.length > 0) ||
                  (vmode === "date" &&
                    datePresets.length + dateSuggestions.length > 0)) && (
                  <CommandSeparator />
                )}
                {setOptions.map((opt) => (
                  <CommandItem
                    key={opt.key}
                    value={opt.key}
                    onSelect={() => pickSetOperator(opt.op)}
                    className={optionClass}
                  >
                    <span>
                      {highlightMatch(
                        opt.label,
                        vmode === "text" || vmode === "number"
                          ? ""
                          : searchText,
                      )}
                    </span>
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </div>
        {/* Requirement 30.1: widget `DateSelector` (ui/date-
          selector.jsx) ter-embed PENUH, di LUAR `CommandList`
          (bukan cmdk item -- kalender punya navigasi keyboard
          sendiri, tak boleh diintersep arrow-key cmdk). Text-
          parse (Enter) & preset TETAP jalan berdampingan --
          embed ini TAMBAHAN, bukan pengganti (Requirement
          30.2). Nilai widget DISIMPAN dulu (`datePickerValue`),
          BUKAN langsung commit per onChange -- interaksi range
          butuh >1 klik; commit sesungguhnya lewat Enter atau
          jalur exit yg sama dgn checkbox-multi. */}
        {showValueList && vmode === "date" && (
          <div
            className="p-2 border-t md:border-t-0 md:border-l md:shrink-0"
            onMouseDown={(e) => {
              e.preventDefault();
              widgetPointerRef.current = true;
            }}
            onKeyDown={() => {
              widgetPointerRef.current = false;
            }}
            onFocusCapture={() => setWidgetFocus(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setWidgetFocus(false);
              }
            }}
          >
            <ReuiDateSelector
              value={reuiDateValue}
              onChange={handleDatePickerChange}
              i18n={reuiDateI18n}
              showTwoMonths={false}
              withTime={dateParseCtx.isDatetime}
              minYear={dateYearBounds.minYear}
              maxYear={dateYearBounds.maxYear}
              allowMultiple
              maxSelections={MAX_DATE_VALUES}
              onSelectionLimit={() => setValueError(dateNoticeText("limit", t))}
            />
          </div>
        )}
      </div>
      {/* Requirement 31 / 42: petunjuk (legend tombol + penjelasan)
          selama mode value aktif, sesuai tipe kolom. */}
      {(mode === "value" || suggestions?.show) && (
        <SearchLegend ctx={legendCtx} />
      )}
    </>
  );
}
