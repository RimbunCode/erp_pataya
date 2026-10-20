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
