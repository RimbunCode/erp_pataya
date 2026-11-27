<?php

namespace Tests\Feature\Finances;

use App\Http\Requests\Finances\PurchaseInvoiceRequest;
use App\Http\Requests\Finances\SalesInvoiceRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.3 (Requirement 13.1/13.3, P-14) dan Q-P2-23 (2026-11-22): request Sales/Purchase Invoice tidak
 * memvalidasi kolom akun sehingga `validated()` membuangnya; akun ditentukan engine. Mode `off`/`shadow` dihapus, jadi
 * aturan akun tidak lagi bergantung pada mode apa pun.
 */
class InvoiceAccountFieldsRemovedTest extends TestCase {
    use RefreshDatabase;

    /**
     * @return array<string, array{0: class-string, 1: array<int, string>}>
     */
    public static function invoiceRequests(): array {
        return [
            'sales'    => [SalesInvoiceRequest::class, ['income_account.id', 'debit_account.id']],
            'purchase' => [PurchaseInvoiceRequest::class, ['expense_head_account.id', 'credit_account.id']],
        ];
    }

    #[Test]
    #[DataProvider('invoiceRequests')]
    public function account_fields_are_never_validated(string $requestClass, array $accountKeys): void {
        $rules = $requestClass::create('/', 'POST')->rules();

        foreach ($accountKeys as $key) {
            $this->assertArrayNotHasKey($key, $rules, "{$key} tidak boleh divalidasi sehingga dibuang dari validated().");
        }
        $this->assertArrayHasKey('items', $rules, 'Aturan lain tetap utuh.');
    }
}
