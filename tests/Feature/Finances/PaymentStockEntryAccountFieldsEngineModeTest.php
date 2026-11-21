<?php

namespace Tests\Feature\Finances;

use App\Enums\PostingDocumentType;
use App\Http\Requests\Finances\PaymentEntryRequest;
use App\Http\Requests\Inventory\StockEntryRequest;
use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Posting\PostingModeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.3 (Requirement 13.1/13.3, P-14) untuk Payment Entry dan Stock Entry (termasuk biaya
 * tambahan): saat mode engine `on`, request tidak lagi memvalidasi kolom akun sehingga `validated()` membuangnya;
 * saat `off`/`shadow` jalur lama tetap mewajibkannya.
 */
class PaymentStockEntryAccountFieldsEngineModeTest extends TestCase {
    use RefreshDatabase;

    private function setMode(PostingDocumentType $type, string $mode): void {
        $modes = array_merge(FinanceSetting::defaultAttributes()['posting_modes'], [$type->value => $mode]);
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['posting_modes' => $modes]);
        PostingModeResolver::forget();
    }

    /**
     * @return array<string, array{0: class-string, 1: PostingDocumentType, 2: array<int, string>}>
     */
    public static function requests(): array {
        return [
            'payment_entry' => [PaymentEntryRequest::class, PostingDocumentType::PaymentEntry, ['account_paid_to.id', 'account_paid_from.id']],
            'stock_entry'   => [StockEntryRequest::class, PostingDocumentType::StockEntry, ['difference_account.id', 'additional_costs.*.expense_account.id']],
        ];
    }

    #[Test]
    #[DataProvider('requests')]
    public function account_fields_are_required_while_mode_is_not_on(string $requestClass, PostingDocumentType $type, array $accountKeys): void {
        foreach (['off', 'shadow'] as $mode) {
            $this->setMode($type, $mode);
            $rules = $requestClass::create('/', 'POST')->rules();

            foreach ($accountKeys as $key) {
                $this->assertArrayHasKey($key, $rules, "Mode {$mode}: {$key} harus divalidasi.");
                $this->assertContains('required', $rules[$key]);
            }
        }
    }

    #[Test]
    #[DataProvider('requests')]
    public function account_fields_are_not_validated_when_mode_is_on(string $requestClass, PostingDocumentType $type, array $accountKeys): void {
        $this->setMode($type, 'on');
        $rules = $requestClass::create('/', 'POST')->rules();

        foreach ($accountKeys as $key) {
            $this->assertArrayNotHasKey($key, $rules, "Mode on: {$key} tidak boleh divalidasi sehingga dibuang dari validated().");
        }
        $this->assertArrayHasKey('date', $rules, 'Aturan lain tetap utuh.');
    }

    #[Test]
    public function other_document_types_mode_does_not_change_the_rules(): void {
        $this->setMode(PostingDocumentType::SalesInvoice, 'on');
        $this->setMode(PostingDocumentType::StockEntry, 'on');

        $payment = PaymentEntryRequest::create('/', 'POST')->rules();
        $this->assertArrayHasKey('account_paid_to.id', $payment, 'Mode Stock Entry tidak boleh melepas akun Payment Entry.');

        $this->setMode(PostingDocumentType::StockEntry, 'off');
        $this->setMode(PostingDocumentType::PaymentEntry, 'on');

        $stock = StockEntryRequest::create('/', 'POST')->rules();
        $this->assertArrayHasKey('difference_account.id', $stock, 'Mode Payment Entry tidak boleh melepas akun Stock Entry.');
    }

    #[Test]
    public function validated_drops_client_supplied_account_columns_when_mode_is_on(): void {
        $this->setMode(PostingDocumentType::StockEntry, 'on');

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
    public function validation_rejects_missing_accounts_while_mode_is_off(): void {
        $this->setMode(PostingDocumentType::StockEntry, 'off');

        $payload = [
            'date'             => now()->toDateString(),
            'additional_costs' => [['id' => 'biaya-1', 'purpose' => 'Angkut', 'amount' => 100]],
        ];
        $rules = collect(StockEntryRequest::create('/', 'POST')->rules())
            ->filter(fn ($rule, string $key): bool => $key === 'date' || str_starts_with($key, 'additional_costs') || str_starts_with($key, 'difference_account'))
            ->all();

        $errors = Validator::make($payload, $rules)->errors();

        $this->assertTrue($errors->has('difference_account.id'));
        $this->assertTrue($errors->has('additional_costs.0.expense_account.id'));
    }
}
