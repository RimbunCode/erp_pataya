import BlockEditDialog from "@/Components/DashboardBlocks/BlockEditDialog";
import DashboardChart from "@/Components/DashboardChart";
import WidgetLinkModel from "@/Pages/Settings/Widget/WidgetLinkModel";

// Feedback user: tombol Edit + Dialog utk block Chart/Card — "Edit" di sini
// berarti GANTI Widget yang dirujuk block ini (bukan edit konfigurasi
// query Widget itu sendiri, yang tetap tanggung jawab Settings/Widget/Form
// terpisah — WidgetLinkModel sudah menyediakan create-inline juga kalau
// user mau buat Widget baru langsung dari sini). Trigger Edit di toolbar
// SortableBlock (Dialog controlled via editOpen/onEditOpenChange).
export default function ChartCardBlock({ block, canEdit, onUpdate, onDelete, editOpen, onEditOpenChange }) {
  const isNumberCard = block.type === "card";

  // Bug ditemukan: DashboardChart menentukan tampilan (kartu angka vs
  // grafik) dari `widget.type` — BUKAN dari `block.type`. Akibatnya block
  // "Number Card" yang diisi Widget bertipe grafik tetap merender grafik.
  // Fix: daftar Widget di picker DIFILTER sesuai tipe block, jadi Number
  // Card hanya bisa menunjuk Widget bertipe `card` dan sebaliknya.
  const widgetFilters = isNumberCard
    ? { type: "card" }
    : { type: { notIn: ["card"] } };

  return (
    <div>
      {block.widget ? (
        <DashboardChart widget={block.widget} />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {isNumberCard ? "Belum ada Number Card dipilih" : "Belum ada Chart dipilih"}
        </div>
      )}
      {canEdit && (
        <BlockEditDialog
          title={isNumberCard ? "Edit Number Card" : "Edit Chart"}
          block={block}
          canEdit={canEdit}
          initialDraft={{ widget: block.widget }}
          open={editOpen}
          onOpenChange={onEditOpenChange}
          isNew={block.isNew}
          onCancelNew={onDelete}
          validate={(draft) => {
            if (!draft.widget?.id) return "Widget wajib dipilih.";
            // Guard kedua (picker sudah difilter, ini jaring pengaman kalau
            // widget lama tersimpan dgn tipe yang tidak cocok).
            const widgetType = draft.widget?.type;
            if (widgetType && isNumberCard !== (widgetType === "card")) {
              return isNumberCard
                ? "Number Card hanya bisa memakai Widget bertipe Card."
                : "Chart tidak bisa memakai Widget bertipe Card.";
            }

            return null;
          }}
          onSave={(draft) => onUpdate({ ...block, widget: draft.widget ?? block.widget, isNew: false })}
          renderForm={(draft, patchDraft) => (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {isNumberCard ? "Number Card" : "Chart"}
              </label>
              <WidgetLinkModel
                value={draft.widget}
                filters={widgetFilters}
                fields={["type"]}
                onValueChange={(val) => patchDraft({ widget: val })}
              />
            </div>
          )}
        />
      )}
    </div>
  );
}
