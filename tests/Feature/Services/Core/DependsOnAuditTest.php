<?php

namespace Tests\Feature\Services\Core;

use App\Models\Model as AppModel;
use Illuminate\Support\Facades\File;
use ReflectionClass;
use Tests\TestCase;

/**
 * Guard audit `dependsOn`: setiap kolom append/accessor (type `attribute`) yang
 * arrayable HARUS punya `dependsOn` agar strict (DataTableColumnSelector::
 * resolveForSafe) dapat menyusun SELECT presisi tanpa throw.
 *
 * Meta global yang TIDAK membaca kolom DB (route/keyModel/thisModel) di-exempt.
 * `appendStatus` di-exempt di sini karena baseline dependsOn-nya disuntik
 * conditional `Schema::hasColumn` di LinkModel::getColumns (model tanpa kolom
 * `status` sengaja tak punya dependsOn).
 *
 * Test ini juga regression guard: model baru dengan append tanpa dependsOn →
 * merah, sebelum sampai produksi.
 */
class DependsOnAuditTest extends TestCase {
    /**
     * Meta global yang exempt dari kewajiban dependsOn (tak baca kolom DB, atau
     * ditangani mekanisme lain).
     *
     * @var list<string>
     */
    private const EXEMPT_APPENDS = [
        'route', 'keyModel', 'thisModel', 'canDelete', 'disabledOn',
        'templateLink', 'appendStatus',
    ];

    public function test_all_arrayable_appends_have_depends_on(): void {
        $offenders = [];

        foreach ($this->dataTableModels() as $class) {
            try {
                $columns = $class::getColumns(1, true);
            } catch (\Throwable $e) {
                $offenders[] = "{$class}: getColumns gagal — {$e->getMessage()}";

                continue;
            }

            foreach ($columns as $col) {
                $name = $col['name'] ?? null;
                if (! is_string($name) || ($col['type'] ?? null) !== 'attribute') {
                    continue;
                }
                if (in_array($name, self::EXEMPT_APPENDS, true)) {
                    continue;
                }
                $dependsOn = $col['dependsOn'] ?? null;
                if (! is_array($dependsOn) || $dependsOn === []) {
                    $offenders[] = "{$class}::{$name}";
                }
            }
        }

        $this->assertSame(
            [],
            $offenders,
            "Append/accessor tanpa dependsOn (wajib untuk strict SELECT pruning):\n" . implode("\n", $offenders),
        );
    }

    /**
     * Semua model di app/Models yang merupakan subclass App\Models\Model
     * (memakai trait LinkModel → getColumns).
     *
     * @return list<class-string<AppModel>>
     */
    private function dataTableModels(): array {
        $base    = app_path('Models');
        $files   = File::allFiles($base);
        $classes = [];

        foreach ($files as $file) {
            $relative = str_replace([$base . DIRECTORY_SEPARATOR, '.php'], '', $file->getRealPath());
            $class    = 'App\\Models\\' . str_replace(DIRECTORY_SEPARATOR, '\\', $relative);

            if (! class_exists($class)) {
                continue;
            }
            $ref = new ReflectionClass($class);
            if ($ref->isAbstract() || ! $ref->isSubclassOf(AppModel::class)) {
                continue;
            }
            $classes[] = $class;
        }

        return $classes;
    }
}
