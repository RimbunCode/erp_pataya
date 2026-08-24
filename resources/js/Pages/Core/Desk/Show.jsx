import DeskForm from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

// Requirement 6 direvisi: halaman show Desk SELALU tanpa
// sidebar/BranchSwitcher/DeskSwitcher, utk SEMUA tipe/kondisi Desk (dulu
// System/shared dapat layout penuh — sekarang tidak ada pengecualian).
// Breadcrumb Home TETAP tampil (hideHomeBreadcrumb default false) — urutan
// "Home > Desks > [Label Desk]" dari prop `breadcrumbs` (di-share manual
// DeskController::show(), bukan lewat setBreadcrumbs() generik).
export default function Show({ desk }) {
  return (
    <FormPage
      isCreate={!desk}
      name="desk"
      hideSidebar
      hideBranchSwitcher
      hideDeskSwitcher
    >
      <DeskForm />
    </FormPage>
  );
}
