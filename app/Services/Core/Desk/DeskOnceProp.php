<?php

namespace App\Services\Core\Desk;

use Closure;
use Inertia\OnceProp;

/**
 * OnceProp yang kuncinya dihitung SAAT DIBUTUHKAN Inertia (bukan saat dibagikan).
 * Kunci sidebar memuat id desk aktif; kalau dihitung di awal, desk harus sudah
 * di-resolve di setiap request -- termasuk reload parsial & XHR yang tak pernah
 * membutuhkan prop ini. PropsResolver Inertia hanya memanggil getKey() untuk
 * prop yang ikut diproses respons.
 */
class DeskOnceProp extends OnceProp {
    public function __construct(callable $callback, private Closure $resolveKey) {
        parent::__construct($callback);
    }

    public function getKey(): ?string {
        return ($this->resolveKey)();
    }
}
