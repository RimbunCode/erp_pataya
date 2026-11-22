<?php

namespace Tests\Unit\Finances\Posting;

use App\Enums\PostingDocumentType;
use PHPUnit\Framework\TestCase;

/**
 * Finance Fase 2, Task 9.2 dan Task 14.1 (P-9; Requirement 7.3; Q-P2-19): pada jenis dokumen yang berada pada mode
 * `on`, pola pencarian akun legacy `where('account_type', ...)` tidak boleh muncul di kode jalurnya (komentar tidak
 * dihitung). Uji ini adalah "grep CI" P-9: ia berjalan di suite Unit pada CI (`paratest --functional`).
 *
 * Penegakan berlaku penuh sejak Task 14.1 (keputusan pemilik produk 2026-11-21; semua jenis dokumen dikonfirmasi `on`
 * 2026-11-22): `ON_TYPES` memuat ke-10 jenis dokumen dan closure legacy (beserta pencarian `account_type`) sudah dihapus
 * dari seluruh berkas jalur. Daftar `ON_TYPES` boleh ditimpa env `POSTING_ON_TYPES` (dipisah koma) untuk menjalankan
 * uji ini terhadap subset jenis.
 */
class PostingLegacyLookupTest extends TestCase {
    /** @var list<string> jenis dokumen pada mode `on` (nilai `PostingDocumentType`) */
    private const ON_TYPES = [
        'asset_depreciation',
        'asset_scrap',
        'asset_value_adjustment',
        'asset_disposal',
        'payment_entry',
        'purchase_receipt',
        'delivery_note',
        'sales_invoice',
        'purchase_invoice',
        'stock_entry',
    ];

    /** @var array<string, list<string>> jenis dokumen => berkas jalur posting (relatif terhadap root proyek) */
    private const PATH_FILES = [
        'asset_depreciation'     => ['app/Listeners/Asset/Depreciation/PostDepreciationEntry.php'],
        'asset_scrap'            => ['app/Listeners/Asset/Depreciation/PostScrapWriteOff.php'],
        'asset_value_adjustment' => ['app/Listeners/Asset/Depreciation/PostValueAdjustmentEntry.php'],
        'asset_disposal'         => ['app/Listeners/Asset/Rental/PostAssetDisposalGainLoss.php'],
        'payment_entry'          => ['app/Services/Finances/PaymentEntryService.php'],
        'purchase_receipt'       => ['app/Listeners/Purchase/Ledger/PostPurchaseReceiptGeneralLedger.php'],
        'delivery_note'          => ['app/Listeners/Inventory/Ledger/PostDeliveryNoteGeneralLedger.php'],
        'sales_invoice'          => ['app/Listeners/Finances/Ledger/PostSalesInvoiceGeneralLedger.php'],
        'purchase_invoice'       => ['app/Listeners/Finances/Ledger/PostPurchaseInvoiceGeneralLedger.php'],
        'stock_entry'            => ['app/Services/Inventory/StockEntryService.php'],
    ];

    private const LEGACY_LOOKUP = '/where\(\s*[\'"]account_type[\'"]/';

    /**
     * @return list<string>
     */
    private function onTypes(): array {
        $fromEnv = getenv('POSTING_ON_TYPES');

        return $fromEnv !== false && $fromEnv !== '' ? array_map('trim', explode(',', $fromEnv)) : self::ON_TYPES;
    }

    private function codeOf(string $relativePath): string {
        return $this->stripComments((string) file_get_contents(\dirname(__DIR__, 4) . '/' . $relativePath));
    }

    private function stripComments(string $source): string {
        $code = '';
        foreach (token_get_all($source) as $token) {
            if (\is_array($token) && \in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }
            $code .= \is_array($token) ? $token[1] : $token;
        }

        return $code;
    }

    private function hasLegacyLookup(string $type): bool {
        foreach (self::PATH_FILES[$type] as $path) {
            if (preg_match(self::LEGACY_LOOKUP, $this->codeOf($path)) === 1) {
                return true;
            }
        }

        return false;
    }

    public function test_every_posting_document_type_has_path_files_that_exist(): void {
        $this->assertEqualsCanonicalizing(array_map(fn (PostingDocumentType $type): string => $type->value, PostingDocumentType::cases()), array_keys(self::PATH_FILES));

        foreach (self::PATH_FILES as $type => $paths) {
            foreach ($paths as $path) {
                $this->assertFileExists(\dirname(__DIR__, 4) . '/' . $path, $type);
            }
        }
    }

    public function test_all_document_types_are_enforced_since_task_14_1(): void {
        // Penegakan P-9 berlaku untuk SEMUA jenis dokumen (Task 14.1). Env `POSTING_ON_TYPES` hanya untuk menyempitkan
        // uji secara lokal; tanpa env, daftar bawaan harus memuat setiap jenis.
        $this->assertEqualsCanonicalizing(array_keys(self::PATH_FILES), self::ON_TYPES);
    }

    public function test_the_detector_flags_account_type_lookups_and_ignores_comments(): void {
        // Self-check detektor memakai string sintetis (pencarian legacy sudah tidak ada di kode): pola terdeteksi dan
        // komentar diabaikan setelah penyaringan token.
        $this->assertSame(1, preg_match(self::LEGACY_LOOKUP, "Account::query()\n    ->where('account_type', 'stock')"));
        $this->assertSame(1, preg_match(self::LEGACY_LOOKUP, 'Account::where( "account_type", "stock")'));
        $this->assertSame(0, preg_match(self::LEGACY_LOOKUP, $this->stripComments("<?php
// ->where('account_type', 'stock')
/* where('account_type', 'x') */")), 'Komentar tidak dihitung setelah penyaringan token.');
    }

    public function test_on_types_have_no_legacy_account_type_lookup_in_their_path(): void {
        $this->assertNotEmpty($this->onTypes());

        foreach ($this->onTypes() as $type) {
            $this->assertArrayHasKey($type, self::PATH_FILES, "Jenis dokumen tidak dikenal: {$type}");
            $this->assertFalse($this->hasLegacyLookup($type), "P-9: jenis `{$type}` berada pada mode `on`, tetapi jalurnya masih memuat where('account_type', ...) (Requirement 7.3).");
        }
    }
}
