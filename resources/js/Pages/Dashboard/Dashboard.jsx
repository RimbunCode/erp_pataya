import { useEffect, useState } from "react";

import AppLayout from "@/Layouts/AppLayout";
import { Button } from "@/Components/ui/button";
import DashboardCanvas from "@/Components/DashboardCanvas";
import { Head } from "@inertiajs/react";
import { PencilIcon } from "lucide-react";
import axios from "axios";
import { gooeyToast } from "@/lib/gooeyToast";

// desk-dashboard-builder: halaman "dashboard" (route existing, dulu union
// SEMUA Dashboard milik user via user_dashboards) sekarang MERUPAKAN Desk
// Home — 1 Desk aktif = 1 Dashboard (Desk::resolveDashboard()), diganti
// TOTAL (mekanisme lama, multi-dashboard-per-user, dihapus). State
// top-level NESTED (block.children) — flatten hanya sesaat sebelum
// dikirim ke endpoint update (design.md: "Bentuk state FE vs payload BE").
function toStateBlock(row) {
  return {
    ref: row.id,
    id: row.id,
    type: row.type,
    widget: row.widget,
    config: row.config,
    width: row.width,
    is_visible: row.is_visible,
    children: (row.children ?? []).map(toStateBlock),
  };
}

// Flatten rekursif: tiap block.children[i] jadi baris root-level dengan
// parent_ref menunjuk ref induknya langsung — payload backend flat, bukan
// nested (design.md, 3-pass create di updateDashboardWidgets).
function flattenBlocks(blocks, parentRef = null) {
  return blocks.flatMap((block) => {
    // isNew: penanda client-only (Dialog auto-open utk block baru) —
    // TIDAK relevan/tidak boleh terkirim ke backend.
    const { children, isNew: _isNew, ...rest } = block;

    return [
      { ...rest, parent_ref: parentRef },
      ...flattenBlocks(children ?? [], block.ref ?? block.id),
    ];
  });
}

// canEditPermission (dari backend, DeskController::canEditDashboard) adalah
// HAK AKSES — apakah user BOLEH mengedit sama sekali. isEditing adalah MODE
// UI aktif SAAT INI — kanvas selalu terbuka read-only dulu (feedback user:
// jangan langsung masuk mode edit begitu buka halaman), tombol "Edit"
// eksplisit yang membuka draft lokal, "Simpan"/"Batal" yang commit/revert.
export default function Dashboard({ dashboard, canEdit: canEditPermission }) {
  const initialWidgets = () => (dashboard?.widgets ?? []).map(toStateBlock);
  const [widgets, setWidgets] = useState(initialWidgets);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftBeforeEdit, setDraftBeforeEdit] = useState(null);

  useEffect(() => {
    if (isEditing) return; // jangan timpa draft yang sedang diedit
    setWidgets(initialWidgets());
  }, [dashboard]);

  const startEditing = () => {
    setDraftBeforeEdit(widgets);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (draftBeforeEdit) setWidgets(draftBeforeEdit);
    setDraftBeforeEdit(null);
    setIsEditing(false);
  };

  const saveEditing = () => {
    setIsSaving(true);
    axios
      .post(window.route("dashboard.widgets.update"), {
        widgets: flattenBlocks(widgets),
      })
      .then(() => {
        setDraftBeforeEdit(null);
        setIsEditing(false);
        gooeyToast.success("Dashboard tersimpan.");
      })
      .catch(() => {
        gooeyToast.error("Gagal menyimpan perubahan dashboard.");
      })
      .finally(() => setIsSaving(false));
  };

  return (
    <AppLayout
      actions={
        canEditPermission ? (
          isEditing ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={cancelEditing}
                disabled={isSaving}
              >
                Batal
              </Button>
              <Button type="button" onClick={saveEditing} disabled={isSaving}>
                {isSaving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={startEditing}>
              <PencilIcon className="size-4" />
              Edit
            </Button>
          )
        ) : undefined
      }
    >
      <Head title={dashboard?.title ?? "Dashboard"} />
      <div className="p-4">
        <DashboardCanvas
          widgets={widgets}
          canEdit={isEditing}
          onChange={setWidgets}
          depth={0}
        />
      </div>
    </AppLayout>
  );
}
