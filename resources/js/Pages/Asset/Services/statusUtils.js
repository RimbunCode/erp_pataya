// Requirement 8 (spec asset-service-progress-workflow): mirror
// AssetService::hasPassedApproval() (app/Models/Asset/AssetService.php) --
// 2 sisi (PHP + JS) HARUS dijaga sinkron manual, daftar 3 status ini yang
// sama persis. Dipakai Show.jsx dan Form.jsx, BUKAN cek literal "approved".
const PRE_APPROVAL_STATUSES = ["draft", "need_approval", "canceled"];

export function hasPassedApproval(status) {
  // Status kosong/null (belum pernah di-set) BUKAN "sudah lewat approval" --
  // .some() di array kosong vacuously false, harus di-guard eksplisit.
  if (!status || status.length === 0) {
    return false;
  }

  return !status.some((s) => PRE_APPROVAL_STATUSES.includes(s));
}
