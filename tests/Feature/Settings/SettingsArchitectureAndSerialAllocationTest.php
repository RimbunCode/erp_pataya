<?php

namespace Tests\Feature\Settings;

use App\Models\Core\Preference;
use App\Models\Finances\FinanceSetting;
use App\Services\Finances\TaxInvoiceSerialAllocator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Finder\Finder;
use Tests\TestCase;

/**
 * P-9 & P-10: spec module-settings-foundation Task 5.7.
 * - P-9: tidak ada pemanggilan `Preference::` di `app/` selain pengecualian terdaftar.
 * - P-10: alokasi nomor seri faktur pajak tidak pernah menghasilkan nomor ganda dan menghormati rentang.
 */
class SettingsArchitectureAndSerialAllocationTest extends TestCase {
    use RefreshDatabase;

    /**
     * Berkas-berkas di app/ yang secara sah masih boleh memanggil Preference::
     * hingga Task 10 (GATED retirement).
     *
     * @var array<int, string>
     */
    private const array ALLOWED_PREFERENCE_FILES = [
        'app/Models/Core/Preference.php',
        'app/Services/Core/Setting/LegacyPreferenceMap.php',
        'app/Services/Core/Setting/PreferenceMigrator.php',
    ];

    public function test_p9_preference_calls_only_in_whitelisted_app_files(): void {
        $appPath = app_path();
        $finder  = (new Finder)
            ->files()
            ->in($appPath)
            ->name('*.php');

        $violations = [];

        foreach ($finder as $file) {
            $relativePath = str_replace('\\', '/', 'app/' . $file->getRelativePathname());
            if (in_array($relativePath, self::ALLOWED_PREFERENCE_FILES, true)) {
                continue;
            }

            $content = $file->getContents();
            if ($relativePath === 'app/Services/Migration/Migrators/User/Roles/RolePermissionMigrator.php') {
                $content = preg_replace('/\bPreference::class\b/', '', $content);
            }
            if (preg_match('/\bPreference::/', $content)) {
                $violations[] = $relativePath;
            }
        }

        $this->assertSame(
            [],
            $violations,
            'P-9 dilanggar: ditemukan pemanggilan Preference:: di berkas app/ di luar whitelist.',
        );
    }

    /**
     * P-9 diperluas: selain `Preference::`, tidak ada `new Preference`,
     * `DB::table('preferences')`, atau akses lewat query builder di app/,
     * routes/, config/, serta seeder dan factory. `Preference::class`
     * (rujukan model untuk izin) tetap diperbolehkan.
     */
    public function test_p9_no_other_access_paths_to_the_preferences_table(): void {
        $allowed = [
            'app/Models/Core/Preference.php',
            'app/Services/Core/Setting/LegacyPreferenceMap.php',
            'app/Services/Core/Setting/PreferenceMigrator.php',
        ];
        $patterns = [
            '/\bnew\s+Preference\b/',
            '/\bPreference::(?!class\b)/',
            '/DB::table\(\s*[\'"]preferences[\'"]/',
            '/Schema::\w+\(\s*[\'"]preferences[\'"]/',
        ];

        $violations = [];
        foreach ($this->phpFilesToScan() as $relativePath => $content) {
            if (in_array($relativePath, $allowed, true)) {
                continue;
            }
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $content)) {
                    $violations[] = "{$relativePath} ({$pattern})";
                }
            }
        }

        $this->assertSame([], $violations, 'Akses ke tabel preferences ditemukan di luar whitelist.');
    }

    /**
     * Requirement 3.6: penulisan setting hanya lewat SettingsService. Tidak
     * boleh ada create/update/save langsung pada model setting, maupun
     * query builder ke tabel setting, di luar service dan seeder/factory.
     */
    public function test_requirement_3_6_settings_are_written_only_through_settings_service(): void {
        $allowed = [
            'app/Services/Core/Setting/SettingsService.php',
            // Migrator data sekali jalan preferences -> tabel setting (Requirement 5);
            // menulis langsung karena aturannya sendiri (idempoten, --force).
            'app/Services/Core/Setting/PreferenceMigrator.php',
        ];
        $models = 'CoreSetting|FinanceSetting|SalesSetting|PurchaseSetting|InventorySetting';
        $tables = 'core_settings|finance_settings|sales_settings|purchase_settings|inventory_settings';
        $writes = 'create|forceCreate|updateOrCreate|firstOrCreate|updateOrInsert|upsert|insert|insertGetId';
        $chains = 'update|save|fill|forceFill|delete|forceDelete|increment|decrement';

        $patterns = [
            "/\\b(?:{$models})::(?:{$writes})\\s*\\(/",
            "/\\b(?:{$models})::(?:query\\(\\)|where\\w*\\([^)]*\\))\\s*->\\s*(?:{$chains}|{$writes})\\s*\\(/",
            "/\\b(?:{$models})::current\\(\\)\\s*->\\s*(?:{$chains})\\s*\\(/",
            "/DB::table\\(\\s*['\"](?:{$tables})['\"]\\s*\\)\\s*->\\s*(?:{$chains}|{$writes})\\s*\\(/",
            // Penulisan lewat variabel instance setting ($setting->save(), $coreSetting->forceFill(...)).
            '/\$\w*setting\w*\s*->\s*(?:save|saveQuietly|fill|forceFill|setAttribute)\s*\(/i',
        ];

        $violations = [];
        foreach ($this->phpFilesToScan(includeSeedersAndFactories: false) as $relativePath => $content) {
            if (in_array($relativePath, $allowed, true)) {
                continue;
            }
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $content)) {
                    $violations[] = "{$relativePath} ({$pattern})";
                }
            }
        }

        $this->assertSame([], $violations, 'Penulisan setting di luar SettingsService ditemukan (Requirement 3.6).');
    }

    /** @return array<string, string> path relatif => isi tanpa komentar */
    private function phpFilesToScan(bool $includeSeedersAndFactories = true): array {
        $directories = ['app', 'routes', 'config'];
        if ($includeSeedersAndFactories) {
            $directories[] = 'database/seeders';
            $directories[] = 'database/factories';
        }

        $files = [];
        foreach ($directories as $directory) {
            $path = base_path($directory);
            if (! is_dir($path)) {
                continue;
            }
            foreach ((new Finder)->files()->in($path)->name('*.php') as $file) {
                $relativePath         = str_replace('\\', '/', $directory . '/' . $file->getRelativePathname());
                $files[$relativePath] = $this->stripComments($file->getContents());
            }
        }

        return $files;
    }

    private function stripComments(string $source): string {
        $code = '';
        foreach (token_get_all($source) as $token) {
            if (is_array($token) && in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }
            $code .= is_array($token) ? $token[1] : $token;
        }

        return $code;
    }

    public function test_p10_serial_allocation_sequential_and_within_range(): void {
        $allocator = app(TaxInvoiceSerialAllocator::class);

        FinanceSetting::updateOrCreate(['singleton' => true], [
            'tax_invoice_serial_range_start' => 10,
            'tax_invoice_serial_range_end'   => 13,
            'tax_invoice_serial_last_used'   => 0,
        ]);

        $first  = $allocator->nextSerial('01', '0');
        $second = $allocator->nextSerial('01', '0');
        $third  = $allocator->nextSerial('01', '0');
        $fourth = $allocator->nextSerial('01', '0');

        $this->assertSame('010.0000000000010', $first);
        $this->assertSame('010.0000000000011', $second);
        $this->assertSame('010.0000000000012', $third);
        $this->assertSame('010.0000000000013', $fourth);

        $this->expectException(ValidationException::class);
        $allocator->nextSerial('01', '0');
    }

    public function test_p10_serial_allocation_rejects_unconfigured_range(): void {
        $allocator = app(TaxInvoiceSerialAllocator::class);

        FinanceSetting::updateOrCreate(['singleton' => true], [
            'tax_invoice_serial_range_start' => 0,
            'tax_invoice_serial_range_end'   => 0,
            'tax_invoice_serial_last_used'   => 0,
        ]);

        $this->expectException(ValidationException::class);
        $allocator->nextSerial('01', '0');
    }

    public function test_p10_serial_allocation_rejects_invalid_transaction_code(): void {
        $allocator = app(TaxInvoiceSerialAllocator::class);

        FinanceSetting::updateOrCreate(['singleton' => true], [
            'tax_invoice_serial_range_start' => 1,
            'tax_invoice_serial_range_end'   => 10,
            'tax_invoice_serial_last_used'   => 0,
        ]);

        $this->expectException(ValidationException::class);
        $allocator->nextSerial('99', '0');
    }
}
