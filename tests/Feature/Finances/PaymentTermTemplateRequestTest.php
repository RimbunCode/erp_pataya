<?php

namespace Tests\Feature\Finances;

use App\Http\Requests\Finances\PaymentTermTemplateRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Regresi: rule `items.*.due_date_based_on` sempat menulis
 * `weeks_after_invoice_date`, padahal SELURUH sisa aplikasi memakai
 * `weeks_after_invoice_week` -- daftar opsi Select & switch kalkulasi due_date
 * di resources/js/Pages/Finances/PaymentTermTemplate/Form.jsx, switch di
 * resources/js/Pages/Finances/Components/PaymentSchedule.jsx, dan 8 file lang
 * (en/id x paymentTerm/salesInvoice/purchaseInvoice/salesOrder). Akibatnya
 * memilih opsi "Minggu setelah minggu faktur" SELALU ditolak dengan pesan
 * "Nilai items.0.due_date_based_on yang dipilih tidak valid."
 *
 * Kolom `due_date_based_on` di tabel payment_terms & payment_term_template_items
 * cuma `string` biasa (tanpa enum di level DB), jadi satu-satunya penjaga
 * konsistensi nilai adalah rule `in:` ini -- karena itu dikunci lewat test.
 */
class PaymentTermTemplateRequestTest extends TestCase {
    use RefreshDatabase;

    /**
     * @return array<string, mixed>
     */
    private function baseData(string $dueDateBasedOn = 'days_after_invoice_date'): array {
        return [
            'name'  => 'Termin 30 Hari',
            'items' => [
                [
                    'id'                => 'abc12',
                    'due_date_based_on' => $dueDateBasedOn,
                    'credit_period'     => 30,
                    'invoice_portion'   => 100,
                ],
            ],
        ];
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function canonicalDueDateBasedOnProvider(): array {
        return [
            'hari setelah tanggal faktur'  => ['days_after_invoice_date'],
            'minggu setelah minggu faktur' => ['weeks_after_invoice_week'],
            'bulan setelah bulan faktur'   => ['months_after_invoice_month'],
        ];
    }

    #[DataProvider('canonicalDueDateBasedOnProvider')]
    public function test_menerima_semua_opsi_due_date_based_on_yang_dirender_form(string $dueDateBasedOn): void {
        $validator = Validator::make(
            $this->baseData($dueDateBasedOn),
            (new PaymentTermTemplateRequest)->rules(),
        );

        $this->assertFalse(
            $validator->fails(),
            "Opsi '{$dueDateBasedOn}' ditolak validasi: " . json_encode($validator->errors()->toArray()),
        );
    }

    public function test_menolak_weeks_after_invoice_date_yang_tidak_pernah_dirender_form(): void {
        $validator = Validator::make(
            $this->baseData('weeks_after_invoice_date'),
            (new PaymentTermTemplateRequest)->rules(),
        );

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.due_date_based_on', $validator->errors()->toArray());
    }

    public function test_due_date_based_on_wajib_diisi(): void {
        $data = $this->baseData();
        unset($data['items'][0]['due_date_based_on']);

        $validator = Validator::make($data, (new PaymentTermTemplateRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('items.0.due_date_based_on', $validator->errors()->toArray());
    }
}
