<?php

namespace Tests\Feature\Finances;

use App\Http\Requests\Finances\PaymentEntryRequest;
use App\Http\Requests\Inventory\StockEntryRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.3 (Requirement 13.1/13.3, P-14) dan Q-P2-23 (2026-11-22) untuk Payment Entry dan Stock Entry
 * (termasuk biaya tambahan): request tidak memvalidasi kolom akun sehingga `validated()` membuangnya; akun ditentukan
 * engine. Tidak ada lagi mode `off`/`shadow` yang mewajibkan akun.
 */
class PaymentStockEntryAccountFieldsRemovedTest extends TestCase {
    use RefreshDatabase;

    /**
     * @return array<string, array{0: class-string, 1: array<int, string>}>
     */
    public static function requests(): array {
        return [
            'payment_entry' => [PaymentEntryRequest::class, ['account_paid_to.id', 'account_paid_from.id']],
            'stock_entry'   => [StockEntryRequest::class, ['difference_account.id', 'additional_costs.*.expense_account.id']],
        ];
    }

    #[Test]
    #[DataProvider('requests')]
    public function account_fields_are_never_validated(string $requestClass, array $accountKeys): void {
        $rules = $requestClass::create('/', 'POST')->rules();

        foreach ($accountKeys as $key) {
            $this->assertArrayNotHasKey($key, $rules, "{$key} tidak boleh divalidasi sehingga dibuang dari validated().");
        }
        $this->assertArrayHasKey('date', $rules, 'Aturan lain tetap utuh.');
    }

    #[Test]
    public function validated_drops_client_supplied_account_columns(): void {
        $payload = [
            'date'               => now()->toDateString(),
            'difference_account' => ['id' => 'akun-klien'],
            'additional_costs'   => [['id' => 'biaya-1', 'expense_account' => ['id' => 'akun-klien'], 'purpose' => 'Angkut', 'amount' => 100]],
        ];
        $rules = collect(StockEntryRequest::create('/', 'POST')->rules())
            ->filter(fn ($rule, string $key): bool => $key === 'date' || str_starts_with($key, 'additional_costs') || str_starts_with($key, 'difference_account'))
            ->all();

        $validated = Validator::make($payload, $rules)->validated();

        $this->assertArrayNotHasKey('difference_account', $validated);
        $this->assertArrayNotHasKey('expense_account', $validated['additional_costs'][0]);
        $this->assertSame('Angkut', $validated['additional_costs'][0]['purpose']);
    }

    #[Test]
    public function validation_passes_without_any_account(): void {
        $payload = [
            'date'             => now()->toDateString(),
            'additional_costs' => [['id' => 'biaya-1', 'purpose' => 'Angkut', 'amount' => 100]],
        ];
        $rules = collect(StockEntryRequest::create('/', 'POST')->rules())
            ->filter(fn ($rule, string $key): bool => $key === 'date' || str_starts_with($key, 'additional_costs') || str_starts_with($key, 'difference_account'))
            ->all();

        $errors = Validator::make($payload, $rules)->errors();

        $this->assertFalse($errors->has('difference_account.id'));
        $this->assertFalse($errors->has('additional_costs.0.expense_account.id'));
    }
}
