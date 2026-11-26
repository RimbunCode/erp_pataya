<?php

namespace App\Services\Finances\Posting\AccountPanel;

use Illuminate\Database\Eloquent\Model;

/**
 * Dipasang oleh `PanelSource` yang dokumennya bisa sah tidak membentuk jurnal sama sekali (mis. Asset Value Adjustment
 * dengan selisih nol). Panel lalu menampilkan "tidak ada jurnal" alih-alih "posting belum berjalan" atau tabel kosong.
 */
interface DeclaresNoJournal {
    public function producesNoJournal(Model $document): bool;
}
