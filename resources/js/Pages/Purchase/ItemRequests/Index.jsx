import { Head, Link, router } from "@inertiajs/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";

import AppLayout from "@/Layouts/AppLayout";
import { Button } from "@/Components/ui/button";
import { ButtonGroup } from "@/Components/ui/button-group";
import { Checkbox } from "@/Components/ui/checkbox";
import { ChevronDownIcon } from "lucide-react";
import MultiSelect from "@/Components/MultiSelect";
import Pagination from "@/Components/Table/Pagination";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import usePermission from "@/Hooks/usePermission";

function rowKey(row) {
  return `${row.source_type}|${row.source_id}`;
}

// Sama seperti kolom "relation" Table2.jsx: linkable hanya kalau user punya
// izin `read` pada model dokumen terkait, kalau tidak (atau dokumennya gak
// ada) tampil sebagai teks polos. Dipakai utk semua kolom relasi di tabel
// ini (Source, Item, Warehouse, Branch) -- bukan cuma Source.
function RelationCell({ label, document, canGlobal }) {
  if (!label) {
    return <span>-</span>;
  }
  if (!document || !canGlobal(document.thisModel, "read")) {
    return <span>{label}</span>;
  }
  return (
    <Link
      className="text-blue-800 dark:text-blue-200 hover:underline"
      href={window.route(`${document.route}.show`, document.id)}
    >
      {label}
    </Link>
  );
}

function WarehouseCell({ names, documents, canGlobal }) {
  const list = (names ?? []).filter(Boolean);
  if (list.length === 0) {
    return <span>-</span>;
  }
  return list.map((name, index) => (
    <React.Fragment key={index}>
      {index > 0 && ", "}
      <RelationCell
        label={name}
        document={documents?.[index]}
        canGlobal={canGlobal}
      />
    </React.Fragment>
  ));
}

// Debounce fetch filter -- MultiSelect changeOnBlur sudah membatasi
// onValueChange ke sekali per tutup-popover, tapi user bisa buka-tutup
// beberapa filter berurutan cepat (mis. Warehouse lalu langsung Branch).
// Delay ini menggabungkan perubahan² itu jadi SATU request, bukan satu per
// filter. Perubahan ke filter BERBEDA dalam window ini di-MERGE (bukan
// saling menimpa) via pendingFiltersRef.
const FILTER_DEBOUNCE_MS = 1500;

function Index({ rows, filterOptions, appliedFilters, documentModels }) {
  const { t } = useLaravelReactI18n();
  const { canGlobal } = usePermission();
  const [selected, setSelected] = React.useState({});
  const pendingFiltersRef = React.useRef(null);
  const debounceTimeoutRef = React.useRef(null);

  React.useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Backend requirePermissionForDocumentType() cek `create` per-model TANPA
  // OR (izin PO tidak otomatis memberi izin PR, begitu jg sebaliknya) --
  // tombol di sini WAJIB gate sama persis, jangan tampil lalu 403 saat diklik.
  const canCreatePurchaseRequest = canGlobal(
    documentModels?.purchaseRequest,
    "create",
  );
  const canCreatePurchaseOrder = canGlobal(
    documentModels?.purchaseOrder,
    "create",
  );

  function toggleRow(row, checked) {
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) {
        next[rowKey(row)] = row;
      } else {
        delete next[rowKey(row)];
      }
      return next;
    });
  }

  function applyFilter(name, values) {
    const base = pendingFiltersRef.current ?? appliedFilters ?? {};
    pendingFiltersRef.current = { ...base, [name]: values };

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = setTimeout(() => {
      router.get(
        route("itemRequests.index"),
        { ...pendingFiltersRef.current, page: 1 },
        { preserveState: true, replace: true },
      );
      pendingFiltersRef.current = null;
    }, FILTER_DEBOUNCE_MS);
  }

  function changePage(page) {
    router.get(
      route("itemRequests.index"),
      { ...appliedFilters, page },
      { preserveState: true, replace: true },
    );
  }

  function createDocument(documentType) {
    const selections = Object.values(selected).map((row) => ({
      source_type: row.source_type,
      source_id: row.source_id,
      quantity: row.shortage_quantity,
    }));
    if (selections.length === 0) {
      return;
    }
    router.post(route("itemRequests.stageBatch"), {
      document_type: documentType,
      selections,
    });
  }

  const selectedCount = Object.keys(selected).length;

  return (
    <AppLayout>
      <Head title={t("purchase.itemRequest.title")} />

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <MultiSelect
              className="w-56"
              value={appliedFilters?.warehouse_ids}
              defaultValue={[]}
              onValueChange={(values) => applyFilter("warehouse_ids", values)}
              options={(filterOptions?.warehouses ?? []).map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.name,
              }))}
              showAllOption
              allOptionLabel={t("purchase.itemRequest.filters.allWarehouses")}
              changeOnBlur
              placeholder={t("purchase.itemRequest.filters.warehouse")}
            />

            <MultiSelect
              className="w-56"
              value={appliedFilters?.branch_ids}
              defaultValue={[]}
              onValueChange={(values) => applyFilter("branch_ids", values)}
              options={(filterOptions?.branches ?? []).map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              showAllOption
              allOptionLabel={t("purchase.itemRequest.filters.allBranches")}
              changeOnBlur
              placeholder={t("purchase.itemRequest.filters.branch")}
            />

            <MultiSelect
              className="w-56"
              value={appliedFilters?.source_types}
              defaultValue={[]}
              onValueChange={(values) => applyFilter("source_types", values)}
              options={filterOptions?.sourceTypes ?? []}
              showAllOption
              allOptionLabel={t("purchase.itemRequest.filters.allSourceTypes")}
              changeOnBlur
              placeholder={t("purchase.itemRequest.filters.sourceType")}
            />
          </div>

          {canCreatePurchaseRequest && canCreatePurchaseOrder && (
            <ButtonGroup className="h-fit">
              <Button
                disabled={selectedCount === 0}
                onClick={() => createDocument("purchaseRequest")}
              >
                {t("purchase.itemRequest.actions.createPurchaseRequest")}
                {selectedCount > 0 ? ` (${selectedCount})` : ""}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={selectedCount === 0}
                    size="icon"
                    aria-label={t("purchase.itemRequest.actions.moreActions")}
                  >
                    <ChevronDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => createDocument("purchaseOrder")}
                  >
                    {t("purchase.itemRequest.actions.createPurchaseOrder")}
                    {selectedCount > 0 ? ` (${selectedCount})` : ""}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          )}
          {canCreatePurchaseRequest && !canCreatePurchaseOrder && (
            <Button
              disabled={selectedCount === 0}
              onClick={() => createDocument("purchaseRequest")}
            >
              {t("purchase.itemRequest.actions.createPurchaseRequest")}
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
          )}
          {!canCreatePurchaseRequest && canCreatePurchaseOrder && (
            <Button
              disabled={selectedCount === 0}
              onClick={() => createDocument("purchaseOrder")}
            >
              {t("purchase.itemRequest.actions.createPurchaseOrder")}
              {selectedCount > 0 ? ` (${selectedCount})` : ""}
            </Button>
          )}
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 p-2"></th>
                <th className="p-2 text-left">
                  {t("purchase.itemRequest.columns.item")}
                </th>
                <th className="p-2 text-left">
                  {t("purchase.itemRequest.columns.source")}
                </th>
                <th className="p-2 text-left">
                  {t("purchase.itemRequest.columns.warehouse")}
                </th>
                <th className="p-2 text-left">
                  {t("purchase.itemRequest.columns.branch")}
                </th>
                <th className="p-2 text-right">
                  {t("purchase.itemRequest.columns.required")}
                </th>
                <th className="p-2 text-right">
                  {t("purchase.itemRequest.columns.covered")}
                </th>
                <th className="p-2 text-right">
                  {t("purchase.itemRequest.columns.available")}
                </th>
                <th className="p-2 text-right">
                  {t("purchase.itemRequest.columns.shortage")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(rows?.data ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-6 text-center text-muted-foreground"
                  >
                    {t("purchase.itemRequest.empty")}
                  </td>
                </tr>
              )}
              {(rows?.data ?? []).map((row) => (
                <tr key={rowKey(row)} className="border-t">
                  <td className="p-2">
                    <Checkbox
                      checked={Boolean(selected[rowKey(row)])}
                      onCheckedChange={(checked) => toggleRow(row, checked)}
                      aria-label={t("purchase.itemRequest.selectRow")}
                    />
                  </td>
                  <td className="p-2">
                    <RelationCell
                      label={row.item_name}
                      document={row.item_document}
                      canGlobal={canGlobal}
                    />
                  </td>
                  <td className="p-2">
                    <RelationCell
                      label={row.source_document?.code ?? row.source_label}
                      document={row.source_document}
                      canGlobal={canGlobal}
                    />
                  </td>
                  <td className="p-2">
                    <WarehouseCell
                      names={row.warehouse_names}
                      documents={row.warehouse_documents}
                      canGlobal={canGlobal}
                    />
                  </td>
                  <td className="p-2">
                    <RelationCell
                      label={row.branch_name}
                      document={row.branch_document}
                      canGlobal={canGlobal}
                    />
                  </td>
                  <td className="p-2 text-right">{row.required_quantity}</td>
                  <td className="p-2 text-right">{row.covered_quantity}</td>
                  <td className="p-2 text-right">{row.available_quantity}</td>
                  <td className="p-2 text-right font-medium text-destructive">
                    {row.shortage_quantity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows?.last_page > 1 && (
          <Pagination
            currentPage={rows.current_page}
            totalPages={rows.last_page}
            changePage={changePage}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default Index;
