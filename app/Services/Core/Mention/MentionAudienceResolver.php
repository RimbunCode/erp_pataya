<?php

namespace App\Services\Core\Mention;

use App\Enums\Permission as PermissionAction;
use App\Models\User\Permission;
use App\Models\User\RolePermission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

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
     * `$document` boleh null bila dokumennya tidak diketahui (mis. id tidak dikirim);
     * aturan only_creator dan cabang lalu tidak bisa dievaluasi, jadi hanya kandidat
     * yang punya entry `read` non-only_creator yang lolos.
     *
     * @param  class-string<Model>  $modelClass  harus sudah lolos resolveModelClass()
     * @param  array<int, string>  $candidateIds
     * @return array<int, string> subset `$candidateIds`, urutan asli dipertahankan
     */
    public function readableBy(string $modelClass, ?Model $document, array $candidateIds): array {
        $candidateIds = array_values(array_unique($candidateIds));
        if ($candidateIds === []) {
            return [];
        }

        $candidateIds = $this->affiliatedWithDocumentBranch($modelClass, $document, $candidateIds);
        if ($candidateIds === []) {
            return [];
        }

        // Model yang mengabaikan permission (Controller melewati guard-nya)
        // terbuka untuk semua user, jadi tidak ada baris role_permissions untuk dicek.
        if (method_exists($modelClass, 'ignoresPermission') && $modelClass::ignoresPermission()) {
            return $candidateIds;
        }

        $creatorId = $document?->getAttribute('created_by_id');
        $creatorId = $creatorId === null ? null : (string) $creatorId;

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
            function (string $userId) use ($access, $creatorId): bool {
                $entry = $access[$userId] ?? null;
                if ($entry === null) {
                    return false;
                }

                return $entry['all'] || ($entry['own'] && $creatorId !== null && $creatorId === $userId);
            },
        ));
    }

    /**
     * Saring kandidat ke yang berafiliasi dengan cabang dokumen, untuk model ber-HasBranch.
     *
     * HasBranch::bootHasBranch() tidak bisa dipakai langsung di sini: global scope itu
     * menjawab "baris mana yang boleh dilihat user yang SEDANG login" lewat Auth::user()
     * dan session `currentBranch`, sedangkan di sini yang dinilai adalah banyak kandidat
     * sekaligus yang tidak punya session. Aturan setaranya dievaluasi lewat pivot
     * `user_branch`: kandidat lolos bila terafiliasi ke cabang dokumen, atau terafiliasi
     * ke main branch (bootHasBranch() juga membebaskan user main-branch dari filter).
     *
     * Model tanpa HasBranch tidak tersaring, dan dokumen tanpa nilai branch juga tidak:
     * tidak ada cabang untuk dibandingkan.
     *
     * @param  class-string<Model>  $modelClass
     * @param  array<int, string>  $candidateIds
     * @return array<int, string>
     */
    private function affiliatedWithDocumentBranch(string $modelClass, ?Model $document, array $candidateIds): array {
        if ($document === null || ! method_exists($modelClass, 'getBranchColumn')) {
            return $candidateIds;
        }

        $branchId = $document->getAttribute($modelClass::getBranchColumn());
        if ($branchId === null) {
            return $candidateIds;
        }

        // whereNull('branches.deleted_at'): query builder mentah melewati global scope
        // SoftDeletes milik Branch, jadi cabang terhapus harus disaring di sini sendiri.
        $affiliated = DB::table('user_branch')
            ->join('branches', 'branches.id', '=', 'user_branch.branch_id')
            ->whereIn('user_branch.user_id', $candidateIds)
            ->whereNull('branches.deleted_at')
            ->where(function ($query) use ($branchId): void {
                $query->where('user_branch.branch_id', $branchId)
                    ->orWhere('branches.is_main_branch', true);
            })
            ->pluck('user_branch.user_id')
            ->map(fn ($id) => (string) $id)
            ->all();

        return array_values(array_filter(
            $candidateIds,
            fn (string $userId) => \in_array($userId, $affiliated, true),
        ));
    }
}
