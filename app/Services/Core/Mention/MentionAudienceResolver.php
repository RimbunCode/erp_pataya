<?php

namespace App\Services\Core\Mention;

use App\Enums\Permission as PermissionAction;
use App\Models\User\Permission;
use App\Models\User\RolePermission;
use Illuminate\Database\Eloquent\Model;

/**
 * Menentukan siapa saja (dari daftar kandidat) yang boleh membaca satu dokumen,
 * sehingga layak muncul di dropdown mention dan layak dikirimi notifikasi mention.
 *
 * Dipakai di dua tempat dengan aturan yang SAMA: UserController::index (menyaring
 * kandidat autocomplete) dan MentionService (lapis kedua saat mengirim notifikasi,
 * karena `data-id`/comment_json datang dari klien dan bisa dipalsukan).
 *
 * Semantik permission mengikuti PermissionChecker::isOnlyCreator() dan
 * DataTable::_checkPermission() (least-restrictive-wins): begitu ada SATU entry
 * `read` level 0 yang BUKAN only_creator, user boleh membaca semua dokumen. Bila
 * seluruh entry `read`-nya only_creator, user hanya boleh membaca dokumen yang
 * `created_by_id`-nya adalah dirinya.
 */
class MentionAudienceResolver {
    /**
     * Validasi class model yang datang dari klien sebelum disentuh sama sekali:
     * harus class Eloquent yang benar-benar ada DAN terdaftar di tabel `permissions`
     * (sumber kebenaran daftar model modul, sama seperti Log::loggableTypeLabel()).
     * Nilai sembarang (class non-model, atau string ngawur) ditolak dengan null.
     *
     * @return class-string<Model>|null
     */
    public function resolveModelClass(?string $modelClass): ?string {
        if (! is_string($modelClass) || $modelClass === '' || ! class_exists($modelClass)) {
            return null;
        }

        if (! is_subclass_of($modelClass, Model::class)) {
            return null;
        }

        if (! Permission::where('model', $modelClass)->exists()) {
            return null;
        }

        return $modelClass;
    }

    /**
     * Saring `$candidateIds` ke user yang punya akses `read` atas dokumen.
     * SATU query bulk untuk semua kandidat, bukan satu query per kandidat.
     *
     * @param  class-string<Model>  $modelClass  harus sudah lolos resolveModelClass()
     * @param  string|null  $documentCreatorId  `created_by_id` dokumen; null bila dokumen belum ada / tak punya kolom itu
     * @param  array<int, string>  $candidateIds
     * @return array<int, string> subset `$candidateIds`, urutan asli dipertahankan
     */
    public function readableBy(string $modelClass, ?string $documentCreatorId, array $candidateIds): array {
        $candidateIds = array_values(array_unique($candidateIds));
        if ($candidateIds === []) {
            return [];
        }

        // Model yang mengabaikan permission (Controller melewati guard-nya)
        // terbuka untuk semua user, jadi tidak ada baris role_permissions untuk dicek.
        if (method_exists($modelClass, 'ignoresPermission') && $modelClass::ignoresPermission()) {
            return $candidateIds;
        }

        $rows = RolePermission::query()
            ->join('user_role', 'user_role.role_id', '=', 'role_permissions.role_id')
            ->join('roles', 'roles.id', '=', 'user_role.role_id')
            ->whereIn('user_role.user_id', $candidateIds)
            ->where('role_permissions.model', $modelClass)
            ->where('role_permissions.level', 0)
            ->where('roles.is_disabled', false)
            ->get(['user_role.user_id', 'role_permissions.only_creator', 'role_permissions.permissions']);

        // userId => ['all' => ada entry read non-only_creator, 'own' => ada entry read only_creator]
        $access = [];
        foreach ($rows as $row) {
            $permissions = $row->permissions;
            if (! is_array($permissions) || empty($permissions[PermissionAction::Read->value])) {
                continue;
            }

            $userId = (string) $row->getAttribute('user_id');
            $access[$userId] ??= ['all' => false, 'own' => false];
            $access[$userId][$row->only_creator ? 'own' : 'all'] = true;
        }

        return array_values(array_filter(
            $candidateIds,
            function (string $userId) use ($access, $documentCreatorId): bool {
                $entry = $access[$userId] ?? null;
                if ($entry === null) {
                    return false;
                }

                return $entry['all'] || ($entry['own'] && $documentCreatorId !== null && $documentCreatorId === $userId);
            },
        ));
    }
}
