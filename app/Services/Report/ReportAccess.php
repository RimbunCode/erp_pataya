<?php

namespace App\Services\Report;

use App\Enums\Permission;
use App\Services\Core\PermissionChecker;
use Illuminate\Http\Request;

/**
 * Pemeriksaan akses baca laporan (spec modul-laporan, Req 6.1 dan 6.2).
 *
 * Laporan tidak punya kolom pembuat, jadi aturan only_creator dari modul sumber tidak bisa
 * diterapkan per baris. Pengguna yang hanya punya izin only_creator ditolak, supaya tidak
 * melihat total seluruh dokumen. Pengguna dengan izin penuh pada modul tetap boleh.
 */
final class ReportAccess {
    public static function canRead(Request $request, string $model): bool {
        $checker = PermissionChecker::forUser($request);

        return $checker->can($model, Permission::Select) && ! $checker->isOnlyCreator($model, Permission::Select);
    }
}
