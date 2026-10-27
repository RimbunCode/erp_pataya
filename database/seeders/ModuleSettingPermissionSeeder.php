<?php

namespace Database\Seeders;

use App\Models\Core\CoreSetting;
use App\Models\Core\ModuleSetting;
use App\Models\Core\Preference;
use App\Models\Finances\FinanceSetting;
use App\Models\Inventory\InventorySetting;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Spec module-settings-foundation, Task 7.1 (Requirement 9).
 *
 * - Memastikan baris Permission ada untuk semua model setting.
 * - Menyalin baris role_permissions dari Permission (model `Preference`)
 *   ke `CoreSetting`, supaya peran yang dulu memegang Company/Preference
 *   tetap membuka halaman Company (Requirement 9.2). Idempoten.
 * - Memberi peran System Manager flag penuh (select/read/write) pada semua
 *   model setting (Requirement 9.2). Halaman setting modul baru tetap
 *   tertutup bagi peran non-admin sampai izin diberikan eksplisit
 *   (Requirement 9.4): modul Permission Finance/Sales memakai nilai khusus
 *   `Setting` yang tidak diklaim profil peran mana pun di AdministratorSeeder.
 */
class ModuleSettingPermissionSeeder extends Seeder {
    /** @return array<int, class-string<ModuleSetting>> */
    public static function settingModels(): array {
        return [
            CoreSetting::class,
            FinanceSetting::class,
            SalesSetting::class,
            PurchaseSetting::class,
            InventorySetting::class,
        ];
    }

    /**
     * Run the database seeds.
     */
    public function run(): void {
        DB::transaction(function (): void {
            foreach (self::settingModels() as $modelClass) {
                $modelClass::initPermissions();
            }

            $this->copyPreferenceRolePermissions();
            $this->grantSystemManager();
        });
    }

    private function copyPreferenceRolePermissions(): void {
        $preferencePermission = Permission::withTrashed()->where('model', Preference::class)->first();
        $corePermission       = Permission::withTrashed()->where('model', CoreSetting::class)->first();

        if (! $preferencePermission || ! $corePermission) {
            return;
        }

        // Hanya izin Preference yang masih aktif yang disalin: baris yang sudah
        // dicabut lewat halaman Roles (soft delete) tidak boleh menghidupkan
        // izin CoreSetting.
        $sourceRows = RolePermission::query()
            ->where('permission_id', $preferencePermission->id)
            ->get();

        foreach ($sourceRows as $source) {
            // Seeder ikut jalan di setiap deploy: buat hanya bila belum ada
            // (termasuk yang sudah dicabut) agar perubahan admin tidak ditimpa.
            RolePermission::withTrashed()->firstOrCreate(
                [
                    'role_id'       => $source->role_id,
                    'permission_id' => $corePermission->id,
                    'level'         => $source->level,
                    'only_creator'  => (bool) $source->only_creator,
                ],
                [
                    'module'        => $corePermission->module,
                    'name'          => $corePermission->name,
                    'model'         => CoreSetting::class,
                    'is_submitable' => (bool) $corePermission->is_submitable,
                    'permissions'   => (array) $source->permissions,
                ],
            );
        }
    }

    private function grantSystemManager(): void {
        // Tanpa scope exclude_example_data: migrasi izin harus melihat semua
        // peran, dan scope itu memakai cache kolom yang bisa basi tepat saat
        // migrasi berjalan (skema RefreshDatabase di-rollback per test).
        $role = Role::withoutGlobalScope('exclude_example_data')->where('name', 'System Manager')->first();
        if (! $role) {
            return;
        }

        foreach (self::settingModels() as $modelClass) {
            $permission = Permission::withTrashed()->where('model', $modelClass)->first();
            if (! $permission) {
                continue;
            }

            // Hanya melengkapi baris yang belum ada; flag yang sudah diubah
            // atau dicabut admin tidak dipulihkan.
            RolePermission::withTrashed()->firstOrCreate(
                [
                    'role_id'       => $role->id,
                    'permission_id' => $permission->id,
                    'level'         => 0,
                    'only_creator'  => false,
                ],
                [
                    'module'        => $permission->module,
                    'name'          => $permission->name,
                    'model'         => $modelClass,
                    'is_submitable' => false,
                    'permissions'   => ['select' => true, 'read' => true, 'write' => true],
                ],
            );
        }
    }
}
