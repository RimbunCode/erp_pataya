import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { Pencil, Plus, Upload } from "lucide-react";
import { useLaravelReactI18n } from "laravel-react-i18n";

import { Button } from "@/Components/ui/button";
import DataTable2 from "@/Pages/Core/DataTable2";
import ImportDialog from "./ImportDialog";
import RateFormDialog from "./RateFormDialog";

// Kurs tidak dapat dihapus lewat halaman ini (izin `delete` tidak ada) dan tidak punya halaman detail: tambah,
// koreksi (hanya yang belum dirujuk transaksi), dan impor CSV, masing-masing di balik izinnya.
export default function Index() {
  const { t } = useLaravelReactI18n();
  const { canWrite, canImport, rateTypes, importMaxMb, importColumns } =
    usePage().props;
  // `null` = tertutup; `{ row: null }` = tambah; `{ row }` = koreksi.
  const [rateDialog, setRateDialog] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const rowActions = useMemo(
    () =>
      canWrite
        ? [
            {
              key: "correct",
              label: t("finances.exchangeRate.page.correct"),
              icon: Pencil,
              enabled: (row) => row.canDelete !== false,
              onAction: (rows) => setRateDialog({ row: rows[0] }),
            },
          ]
        : [],
    [canWrite, t],
  );

  return (
    <>
      <DataTable2
        selectable={false}
        hideDeleteAction
        rowActions={rowActions}
        beforeTable={
          (canWrite || canImport) && (
            <div className="flex flex-wrap gap-2 px-4 pb-2">
              {canWrite && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setRateDialog({ row: null })}
                >
                  <Plus />
                  {t("finances.exchangeRate.page.add")}
                </Button>
              )}
              {canImport && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload />
                  {t("finances.exchangeRate.page.import")}
                </Button>
              )}
            </div>
          )
        }
      />
      {rateDialog && (
        <RateFormDialog
          rateTypes={rateTypes}
          row={rateDialog.row}
          onClose={() => setRateDialog(null)}
        />
      )}
      {importOpen && (
        <ImportDialog
          maxMb={importMaxMb}
          columns={importColumns}
          onClose={() => setImportOpen(false)}
        />
      )}
    </>
  );
}
