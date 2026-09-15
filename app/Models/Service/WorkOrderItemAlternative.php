<?php

namespace App\Models\Service;

use App\Models\Model;

class WorkOrderItemAlternative extends Model {
    // ponytail: tabel cuma punya FK work_order_item_id (lihat migration) —
    // belum ada kolom identitas alternative item apapun, jadi templateLink
    // fallback ke id. Upgrade ke field yang bermakna kalau kolom itemnya
    // sudah ditambahkan.
    public static function templateLink() {
        return ':id';
    }
}
