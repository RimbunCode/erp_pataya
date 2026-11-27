<?php

namespace Tests\Feature\Finances\Posting;

use App\Http\Requests\Asset\AssetValueAdjustmentRequest;
use App\Http\Requests\Finances\PaymentEntryRequest;
use App\Http\Requests\Finances\PurchaseInvoiceRequest;
use App\Http\Requests\Finances\SalesInvoiceRequest;
use App\Http\Requests\Inventory\StockEntryRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
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

    /**
     * @return array<string, array{0: class-string}>
     */
    public static function invoiceRequests(): array {
        return [
            'sales_invoice'    => [SalesInvoiceRequest::class],
            'purchase_invoice' => [PurchaseInvoiceRequest::class],
        ];
    }

    /**
     * Payload yang benar-benar memuat kolom akun (header dan baris) dikirim lewat
     * validator dengan kunci aturan request aslinya; `validated()` (yang dipakai controller) tidak boleh
     * mengembalikan kunci akun apa pun. Aturan nilai diganti `nullable` supaya tes tidak bergantung pada data DB;
     * yang diuji adalah himpunan kunci yang lolos, termasuk aturan induk `items` => `array`. Sub-objek relasi baris (`items.*.item.*`, `items.*.unit.*` nullable) sengaja di luar cakupan: aturan itu meloloskan sub-kunci apa pun, tetapi service hanya membaca `id` dari objek tersebut.
     */
    #[Test]
    #[DataProvider('invoiceRequests')]
    public function validated_payload_drops_account_fields_sent_by_the_client(string $requestClass): void {
        $rules = [];
        foreach ($requestClass::create('/', 'POST')->rules() as $key => $rule) {
            $rules[$key] = $key === 'items' ? ['required', 'array'] : ['nullable'];
        }

        $accountFields = [
            'debit_account_id'        => 'acc-1',
            'income_account_id'       => 'acc-2',
            'credit_account_id'       => 'acc-3',
            'expanse_head_account_id' => 'acc-4',
            'expense_head_account'    => 'acc-5',
            'debit_account'           => ['id' => 'acc-6'],
        ];
        $payload = [
            'date'  => '2026-11-12',
            'items' => [[
                'id'                => 'row-1',
                'quantity'          => 1,
                'posted_account_id' => 'acc-7',
                'posted_account'    => ['id' => 'acc-8'],
                'item'              => ['id' => 'x'],
                'unit'              => ['id' => 'y'],
            ]],
            ...$accountFields,
        ];

        $validated = Validator::make($payload, $rules)->validated();

        $this->assertSame('2026-11-12', $validated['date'], 'Kolom non-akun tetap lolos.');
        $this->assertSame('row-1', $validated['items'][0]['id']);
        $this->assertSame([], $this->accountKeysIn($validated), 'Kunci akun lolos validated(): ' . json_encode($this->accountKeysIn($validated)));
    }

    /**
     * @param  array<array-key, mixed>  $data
     * @return list<string> jalur kunci yang mengandung kata account
     */
    private function accountKeysIn(array $data, string $prefix = ''): array {
        $found = [];
        foreach ($data as $key => $value) {
            $path = $prefix === '' ? (string) $key : "{$prefix}.{$key}";
            if (preg_match('/account/i', (string) $key) === 1) {
                $found[] = $path;
            }
            if (\is_array($value)) {
                $found = [...$found, ...$this->accountKeysIn($value, $path)];
            }
        }

        return $found;
    }
}
