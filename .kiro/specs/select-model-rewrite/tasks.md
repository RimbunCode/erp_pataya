# Tasks: SelectModel Rewrite

> Urutan dependency: backend (endpoint) → frontend (helper filter-tree → hook → komponen) → migrasi consumer → test → lint.
> Status: `[ ]` todo · `[~]` queued · `[-]` in progress · `[x]` done. Optional: `- [ ]* <id>`.
> Lint/Pint HANYA setelah semua task selesai (T07). Referensi requirement `(_R<n>_)` & design `(§<n>)`.

## T01: Backend — Endpoint `model.selectData`

- [x] 1. Tambah route `POST /model/select-data` → `ModelController::selectData` (name `model.selectData`, middleware `auth`) di `routes/web.php` setelah `model.datatable` (§4.1). _R1.1_
- [x] 2. Buat `ModelController::selectData(Request $request)`: validasi `model` (422 bila invalid); resolusi `$target` dari `select` via `(new $parent)->$select()` (422 bila relasi invalid) (§4.2 langkah 1-2). _R1.2-1.4, R1.10, R10.4-10.5_
- [x] 3. Bangun `columns = $target::getColumns(1)`; tandai `show`/`order` dari `$request->columns` (reuse `columns()` `:308-319`). _R1.5_
- [x] 4. Mode per-item: baca `$target::$parentRelation`, set `$parentColumn` (snake-case), tambahkan ke `with`, un-ignore kolom parent di `columns` (`show=true`); degradasi anggun bila `$parentRelation` null (§4.3). _R9.1-9.4_
- [x] 5. Filter tiga jalur (§4.2 langkah 5), semua AND: (a) `baseFilters` (tree LinkModel) → `LinkModelFilterConverter::toTree` → `FilterEvaluator::apply` (reuse mekanisme `ModelController::applyLinkModelFilters` `:93-97`, commit `b56801c` — jadikan reusable: extract helper/trait atau panggil converter+evaluator langsung); (b) `filters` (`{root:{k,o,v,c}}` native) → `FilterEvaluator::apply` LANGSUNG; (c) `fid` (saved filter) via macro→`FilterEvaluator`. Sort/page/show/submitable via macro `dataTable`. `filterToQuery` lama TIDAK dipakai (hanya jalur JoinClause). _R8.1-8.6, R11.1-11.6_
- [x] 6. Response `{ model:$target, route, translateKey, columns, parentColumn, data }` (§4.2 langkah 6). _R1.5-1.6, R9.5_

## T02: Frontend — JsDoc Filter (dua kanal)

- [x] 7. Tulis JsDoc lengkap `LinkModelFilterTree` (grammar, operator PENUH termasuk date→in_period, contoh, catatan **NON-EDITABLE**, `@see` linkModelUtils + `linkModelToFilterTree.js` + `LinkModelFilterConverter.php` + `FilterEvaluator.php`) di atas typedef prop `from.filters`/`selects[].filters` SelectModel — design §3.3 (R8.8). _R8.8_
- [x] 8. **TIDAK perlu adapter `treeToLinkModel`.** Output `FilterBuilder` (`{root:{k,o,v,c}}` native) dikirim apa adanya sbg param `filters`; `from.filters` (tree LinkModel) dikirim apa adanya sbg param `baseFilters`. Helper `resources/js/lib/linkModelToFilterTree.js` (dua arah) SUDAH ada bila konversi diperlukan di tempat lain — tak dipakai jalur ini (§3.4). _R8.1, R8.3_

## T03: Frontend — Hook `useSelectModel`

- [x] 9. Buat `resources/js/Components/SelectModel/useSelectModel.js` dengan state: `activeModel`, `activeView` (SELF_OPTION|relasi), `columns`/`columnMap`/`parentColumn`, `data`, `pagination{currentPage,lastPage,perPage,total}`, `sort`, `userFilters` (FilterBuilder), `savedFilterId` (fid, null default), `loading`, `translateKey` cache (§5.2). _R7.1, R3.2_
- [x] 10. Normalisasi `from`: string → `{[class]:{}}`, object → as-is; warning dev bila key `select` singular ditemukan (§5.1). _R2.1-2.4_
- [x] 11. `loadData()`: kirim DUA field terpisah (tanpa konversi/gabung FE) — `baseFilters`(dari `from`, tree LinkModel apa adanya) + `filters`(=`userFilters` FilterBuilder `value`, `{root:{k,o,v,c}}` native apa adanya); `POST model.selectData {model,select,columns,baseFilters,filters,fid?,sort,page,show,with}`. `fid` hanya bila `savedFilterId` ada. `userFilters` = filter user-only (`from.filters` TIDAK masuk). AbortController batalkan request lama. Debounce 300ms hanya filter. TIDAK ada `saved-filters.store` pada apply biasa (§5.2, §3.4-3.5). _R8.1-8.5, R10.3_
- [x] 12. `select` param = `activeView===SELF_OPTION ? null : activeView`. _R3.2-3.4_
- [x] 13. `setActiveModel`: reset view SELF, clear filter user, page 1, reload. `setActiveView`: page 1, reload. `setPerPage`: page 1, reload. `setPage`: reload. `applyFilters`/`clearFilters`/`setSort`/`resetSorting`. _R4.2-4.4, R7.4, R8.6_
- [x] 14. `confirmSelection`: tentukan mode (direct|self-extraction|per-item); `items` = rows / `flatMap(r=>r[rel])` / rows; `applyColumnAlias(items, columnAlias)`; panggil `onSelected({items,model,mode,sourceModel,sourceIds})`; no-op bila kosong (§5.3). _R3.3-3.5, R5.1-5.6_
- [x] 15. Compute `modelOptions`, `viewOptions`, `selectedCount`; fungsi murni `applyColumnAlias(rows,alias)`. _R5.2, R5.7, R7.1_

## T04: Frontend — Rewrite `SelectModel.jsx`

- [x] 16. Rewrite pakai `useSelectModel`. Props eksternal `{title?,label,variant,size,className?,from,onSelected}` (§5.4). _R5.1_
- [x] 17. Model selector: `<Select>` bila >1 model (sembunyi bila 1), label dari `translateKey`. Ganti `PermissionLinkModel` (§5.4). _R7.1-7.3_
- [x] 18. View selector: `<Select>` bila `selects` ada — opsi SELF_OPTION + tiap relasi (§5.4). _R3.2_
- [x] 19. Filter UI: `<FilterBuilder columns={columnMap} value={userFilters} onChange={setUserFilters} />` + tombol Clear/Apply. `value`=`userFilters` user-only — `from.filters` TIDAK di-load (NON-EDITABLE). JANGAN pakai `FilterItem` lama (§5.4). _R4.5, R8.2, R8.3, R8.7_
- [x] 20. `Table2`: `persistColumns={false}`, `isDynamicData`, `selectable`, `columns=columnMap` (re-sort by `order`), tampilkan `parentColumn` saat per-item (§5.4). _R4.6, R9.5_
- [x] 21. Pagination + show: `<Select>` per-page (10/25/50/100) + `<Pagination>` + total (§5.4). _R4.1-4.4_
- [x] 22. Footer: Cancel + "Select (N)" (selectedCount) (§5.4). _R5.7_
- [x] 23. Hapus import `PermissionLinkModel`, `configModel` body, `filterModel`/`normalizeFilters` lama, semua `console.log`, blok komentar mati; hapus `qs` bila tak dipakai. Target ~250 baris (§5.4, §11). _R12.1-12.7_

## T05: Frontend — `loadFromModel`

- [x] 24. Update `loadFromModel(model, id, select, t)`: pakai `model.selectData` dengan `baseFilters:{id}` (tree LinkModel), `with:[select]` bila select; return `{items,model,mode,sourceModel,sourceIds}` selaras `onSelected`; error `t("core.errors.fetch_failed")`, return `null` bila gagal (§5.5). _R6.1-6.6_

## T06: Migrasi Consumer

- [x] 25. `Purchase/PurchaseOrders/Form.jsx`: `from` `select:`→`selects:`; `filters` tree LinkModel apa adanya (tanpa konversi); `columnAlias` tetap; `mergeItems(value,model)`→`mergeItems({items,model})`; `loadFromModel(...,t)` → `mergeItems(result)` (guard null) (§6). _R2.6, R5, R6_
- [x] 26. `Purchase/PurchaseRequests/Form.jsx`: pastikan `selects:`; `filters` tree LinkModel apa adanya; `mergeItems({items,model})` (§6). _R2.6, R5_
- [x] 27. `Sales/SalesOrders/Form.jsx`: `select:`→`selects:`; `filters` tree LinkModel apa adanya; `columnAlias` (`quantity:remaining_quantity`); `mergeItems({items,model})`; `loadFromModel(...,t)` (§6). _R2.6, R5, R6_
- [x] 28. Verifikasi field quantity tiap `mergeItems` cocok dengan `columnAlias` model masing-masing (SO `remaining_quantity`, PO `unordered_quantity`) (§6 TV4). _R5.5_

## T07: Testing Backend

- [x] 29. Buat `tests/Feature/Http/ModelSelectDataTest.php` (factory). Kasus: model valid tanpa `select` → response shape paginated. _R1.5_
- [x] 30. model + `select` valid → `model`=related, `parentColumn` ter-set, relasi parent ter-load. _R1.4, R9_
  > Stub model + tabel test-only (`SelectStubParent`/`SelectStubChild`/`SelectStubChildNoParent`), meniru kondisi produksi (`$parentRelation` + parent `ignore:true`) tanpa global scope `is_example` berat.
  > ✅ `test_select_resolves_related_model_and_paginates_relation_data` (R1.4: model=related class, data paginated, translateKey relasi).
  > ✅ `test_select_sets_parent_column_string` (R9.1: parentColumn=snake($parentRelation)).
  > ✅ `test_select_parent_column_present_in_metadata` (R9.3: kolom parent di-re-inject, show=true, type=relation).
  > ✅ `test_select_eager_loads_parent_relation_in_data` (R9.2: parent ter-load via addSelect FK).
  > ✅ `test_select_without_parent_relation_degrades_gracefully` (R9.4: parentColumn=null, per-item tetap jalan).
  > **BUG R9.2+R9.3 ditemukan & DIPERBAIKI** saat task ini (re-inject kolom parent + addSelect FK eksplisit di `selectData`). Detail: **design.md §8.1**.
- [x] 31. model invalid → 422; `select` invalid → 422. _R1.10, R10.4-10.5_
- [x] 32. `baseFilters` (tree LinkModel: `=`, `>`, `in`, `like`, `or`, relasi nested, date→in_period, `between`) → terfilter; `filters` (`{root:{k,o,v,c}}` native) → terfilter; `baseFilters`+`filters` bersama → AND; `sort`/`page`/`show` benar; submitable scope. _R8.1-8.6, R11_
- [x] 33. `fid` (SavedFilter via factory) → hasil terfilter; `baseFilters`+`filters`+`fid` bersama → AND. _R8.4-8.5, R11.4-11.5_
- [x] 34. Jalankan `php artisan test --compact --filter=ModelSelectData` — pass.

## T08: Verifikasi Manual (Checkpoint — STOP, konfirmasi user)

- [ ] 35. PO Form: self-extraction (semua items 1 WO) — `mergeItems` benar (quantity, referenceable). _R3.3, R5_
- [ ] 36. PO Form: per-item (item A WO1 + item B WO2 + lintas PR) — hanya item terpilih, kolom parent tampil. _R3.4-3.5, R9.5_
- [ ] 37. Filter apply (FilterBuilder native → terfilter; `from.filters` non-editable tetap berlaku & tak tampil), clear, pagination, ganti per-page, ganti model/view. _R4, R8_
- [ ] 38. Regresi SO & PR Form impor; `loadFromModel` deep-link saat mount (`baseFilters:{id}`). _R6, NFR no-regresi_

## T09: Lint Final

- [x] 39. `vendor/bin/pint --dirty --format agent` (PHP) + eslint --fix (JS). Bersih (0 errors; sisa warning jsdoc kosmetik). `npm run build` sukses. _R12_

---

## Catatan Implementasi (anti-mismatch)

- **Kontrak filter = §3 design (SUMBER KEBENARAN).** Grammar tree LinkModel & operator WAJIB persis (sama LinkModel); JsDoc wajib (§3.3).
- **Filter tiga jalur (semua AND):** `baseFilters` (tree LinkModel, NON-EDITABLE) via `LinkModelFilterConverter`→`FilterEvaluator` + `filters` (FilterBuilder `{root:{k,o,v,c}}` native) via `FilterEvaluator` langsung + `fid` via `FilterEvaluator` (HANYA saved filter). NOL konversi FE. Tidak ada persist otomatis tiap apply. Tidak ada `[col,op,val]`.
- **Reuse, bukan tulis ulang:** `FilterBuilder`/`useNestedFilters`, `Pagination`, `Select`, macro `dataTable`, `LinkModelFilterConverter`+`FilterEvaluator` (jalur Builder, commit `b56801c`), `linkModelToFilterTree.js`, `getColumns`. (`filterToQuery`/`filterOperator` lama hanya jalur `JoinClause`.)
- **`$parentRelation` sudah ada** (`WorkOrderItem`→`workOrder`, `PurchaseRequestItem`→`purchaseRequest`); relasi parent `ignore:true` di `configColumns` → un-ignore kondisional saat per-item.
- **`getColumns` `usort` by name** (`LinkModel.php:624`) → frontend re-sort by `order`.
- **`columnAlias` diterapkan di FE** (`applyColumnAlias`) sebelum `onSelected` — bukan di backend.
- **`SELF_OPTION="__self__"` dipertahankan.**
- Endpoint `model.columns` lama tetap ada (dipakai tempat lain), tak lagi dipanggil dialog.
