<?php

namespace Tests\Feature\Finances;

use App\Enums\PostingDocumentType;
use App\Http\Requests\Finances\PurchaseInvoiceRequest;
use App\Http\Requests\Finances\SalesInvoiceRequest;
use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Posting\PostingModeResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.3 (Requirement 13.1/13.3, P-14): saat mode engine `on`, request Sales/Purchase Invoice tidak
 * lagi memvalidasi kolom akun sehingga `validated()` membuangnya; saat `off`/`shadow` jalur lama tetap mewajibkannya.
 */
class InvoiceAccountFieldsEngineModeTest extends TestCase {
    use RefreshDatabase;

    private function setMode(PostingDocumentType $type, string $mode): void {
        $modes = array_merge(FinanceSetting::defaultAttributes()['posting_modes'], [$type->value => $mode]);
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['posting_modes' => $modes]);
        PostingModeResolver::forget();
    }

    /**
     * @return array<int, array{0: class-string, 1: PostingDocumentType, 2: array<int, string>}>
     */
    public static function invoiceRequests(): array {
        return [
            'sales'    => [SalesInvoiceRequest::class, PostingDocumentType::SalesInvoice, ['income_account.id', 'debit_account.id']],
            'purchase' => [PurchaseInvoiceRequest::class, PostingDocumentType::PurchaseInvoice, ['expense_head_account.id', 'credit_account.id']],
        ];
    }

    #[Test]
    #[DataProvider('invoiceRequests')]
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
    #[DataProvider('invoiceRequests')]
    public function account_fields_are_not_validated_when_mode_is_on(string $requestClass, PostingDocumentType $type, array $accountKeys): void {
        $this->setMode($type, 'on');
        $rules = $requestClass::create('/', 'POST')->rules();

        foreach ($accountKeys as $key) {
            $this->assertArrayNotHasKey($key, $rules, "Mode on: {$key} tidak boleh divalidasi sehingga dibuang dari validated().");
        }
        $this->assertArrayHasKey('items', $rules, 'Aturan lain tetap utuh.');
    }

    #[Test]
    public function resolver_reports_on_only_for_the_document_type_that_is_on(): void {
        $this->setMode(PostingDocumentType::SalesInvoice, 'on');

        $resolver = app(PostingModeResolver::class);
        $this->assertTrue($resolver->isOn(PostingDocumentType::SalesInvoice));
        $this->assertFalse($resolver->isOn(PostingDocumentType::PurchaseInvoice));
    }
}
