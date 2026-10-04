<?php

namespace App\Services\Core;

/**
 * Cache in-memory (statis, per proses PHP) untuk App\Traits\HasBranch::bootHasBranch()
 * -- scope ini jalan ULANG di SETIAP query model ber-HasBranch (route-model-binding
 * halaman Show, tiap relasi ber-HasBranch yang di-eager-load, tiap partial reload
 * Inertia::defer dari App\Traits\DataTable::showDetail()). Satu halaman Show bisa
 * memicu scope ini puluhan kali per request (apalagi dgn beberapa defer group
 * jalan bareng) -- tanpa cache, query afiliasi main-branch user + lookup Branch
 * currentBranch ikut terulang tiap kali, termasuk di partial reload yang sama
 * sekali tak butuh data branch. Pola sama dgn SchemaColumnCache/DataTableScope.
 * Ditaruh di class dedicated (bukan static property trait) karena static property
 * trait di-duplikasi per class consumer -- tak benar2 jadi satu cache global lintas
 * model (SalesOrder, PurchaseOrder, Item, dst semua pakai HasBranch).
 */
class BranchScopeCache {
    /** @var array<string, bool> */
    private static array $userIsMainBranch = [];

    /** @var array<string, string|null> */
    private static array $branchId = [];

    public static function userIsMainBranch(string $userId, callable $resolve): bool {
        return self::$userIsMainBranch[$userId] ??= $resolve();
    }

    public static function branchId(string $sessionBranchId, callable $resolve): ?string {
        return \array_key_exists($sessionBranchId, self::$branchId)
            ? self::$branchId[$sessionBranchId]
            : self::$branchId[$sessionBranchId] = $resolve();
    }

    /** Dipanggil test yang mengubah user/branch di tengah proses. */
    public static function forget(): void {
        self::$userIsMainBranch = [];
        self::$branchId         = [];
    }
}
