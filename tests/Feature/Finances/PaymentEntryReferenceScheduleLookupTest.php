<?php

namespace Tests\Feature\Finances;

use App\Models\Finances\SalesInvoice;
use App\Models\Model as BaseModel;
use App\Models\User\User;
use Database\Factories\Finances\SalesInvoiceFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Regresi: form Payment Entry (jalur "Referensi ke") memilih faktur lewat route `model` dengan
 * `with: paymentSchedules`. Kolom jadwal di luar `templateLink` ikut terpotong gate kolom
 * `ModelController` karena belum `linkable`, sehingga baris jadwal tampil kosong dan Payment Entry
 * tidak bisa dibuat. Test ini mengunci payload yang dibutuhkan form (`due_date`, `payment_amount`,
 * `paid_amount`, `outstanding_amount`) pada setiap jadwal.
 */
class PaymentEntryReferenceScheduleLookupTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        SalesInvoice::initPermissions();
        $this->withoutMiddleware();
        $this->actingAs(User::factory()->create());
    }

    /**
     * @return array<string, mixed>
     */
    private function lookupInvoice(SalesInvoice $invoice): array {
        $response = $this->postJson(route('model'), [
            'model'   => SalesInvoice::class,
            'filters' => ['id' => $invoice->id],
            'with'    => ['paymentSchedules', 'paymentSchedules.paymentMethod'],
            'fields'  => [
                'payment_schedules.due_date',
                'payment_schedules.payment_amount',
                'payment_schedules.paid_amount',
                'payment_schedules.outstanding_amount',
            ],
        ], ['X-Requested-With' => 'XMLHttpRequest']);
        $response->assertOk();

        $row = collect($response->json('data'))->firstWhere('id', $invoice->id);
        $this->assertNotNull($row);

        return $row;
    }

    #[Test]
    public function lookup_returns_schedule_amounts_and_due_date_for_the_payment_entry_form(): void {
        $invoice = BaseModel::withoutEvents(fn () => SalesInvoiceFactory::new()->create());
        $invoice->paymentSchedules()->create([
            'invoice_portion' => 100,
            'payment_amount'  => 1000000,
            'paid_amount'     => 400000,
            'due_date'        => '2026-11-30 00:00:00',
            'for_internal'    => false,
        ]);

        $schedules = $this->lookupInvoice($invoice)['payment_schedules'] ?? [];

        $this->assertCount(1, $schedules);
        $this->assertEquals(600000, $schedules[0]['outstanding_amount']);
        $this->assertEquals(1000000, $schedules[0]['payment_amount']);
        $this->assertEquals(400000, $schedules[0]['paid_amount']);
        $this->assertNotEmpty($schedules[0]['due_date']);
    }
}
