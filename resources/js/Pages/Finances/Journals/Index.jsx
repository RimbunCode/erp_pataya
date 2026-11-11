import DataTable2 from "../../Core/DataTable2";
import React from "react";

// Jurnal hanya dibuat oleh JournalService dan tidak dapat dihapus: tanpa tombol
// tambah (izin `create` tidak ada) dan tanpa pilih-banyak/hapus massal.
export default function Index() {
  return (
    <DataTable2
      selectable={false}
      hideDeleteAction
      classNameDialog="max-w-(--breakpoint-2xl)!"
    />
  );
}
