<?php

namespace Tests\Feature\Finances\Posting;

use App\Http\Requests\Asset\AssetValueAdjustmentRequest;
use App\Http\Requests\Finances\PaymentEntryRequest;
use App\Http\Requests\Finances\PurchaseInvoiceRequest;
use App\Http\Requests\Finances\SalesInvoiceRequest;
use App\Http\Requests\Inventory\StockEntryRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.6 (P-14, Requirement 13.1-13.2): FormRequest semua jenis dokumen yang akunnya ditentukan
 * engine (Sales/Purchase Invoice, Payment Entry, Stock Entry beserta biaya tambahan dan barisnya, Asset Value
 * Adjustment) tidak memiliki aturan validasi untuk kolom akun mana pun, sehingga `validated()` membuang akun kiriman
 * klien dan akun tercatat hanya berasal dari resolver (keseluruhan alurnya dicakup `InvoicePostedAccountWritebackTest`
 * dan `PostedAccountWritebackTest`). Menyapu SEMUA kunci aturan (bukan daftar tetap) supaya field akun baru yang
 * ditambahkan kelak ke request tertangkap.
 */
class AccountFieldsNotValidatedTest extends TestCase {
    use RefreshDatabase;

    /**
     * @return array<string, array{0: class-string}>
     */
    public static function engineManagedRequests(): array {
        return [
            'sales_invoice'          => [SalesInvoiceRequest::class],
            'purchase_invoice'       => [PurchaseInvoiceRequest::class],
            'payment_entry'          => [PaymentEntryRequest::class],
            'stock_entry'            => [StockEntryRequest::class],
            'asset_value_adjustment' => [AssetValueAdjustmentRequest::class],
        ];
    }

    #[Test]
    #[DataProvider('engineManagedRequests')]
    public function no_validation_rule_targets_an_account_column(string $requestClass): void {
        $rules = $requestClass::create('/', 'POST')->rules();

        $this->assertNotSame([], $rules, 'Request tetap memvalidasi kolom lain.');
        foreach (array_keys($rules) as $key) {
            $this->assertDoesNotMatchRegularExpression('/account/i', (string) $key, "Kunci aturan {$key} menyentuh kolom akun; akun hanya boleh dari engine (P-14).");
        }
    }
}
