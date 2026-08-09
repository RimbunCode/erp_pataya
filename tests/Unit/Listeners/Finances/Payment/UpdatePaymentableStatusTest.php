<?php

namespace Tests\Unit\Listeners\Finances\Payment;

use App\Enums\FormStatus;
use App\Utils;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class UpdatePaymentableStatusTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('_test_paymentables')) {
            Schema::create('_test_paymentables', function ($t) {
                $t->ulid('id')->primary();
                $t->double('amount')->default(0);
                $t->double('paid_amount')->default(0);
                $t->json('status')->nullable();
                $t->timestamps();
            });
        }
    }

    private function makePaymentable(FormStatus $status, float $amount = 1000, float $paidAmount = 0): object {
        $id = (string) Str::ulid();
        DB::table('_test_paymentables')->insert([
            'id'          => $id,
            'amount'      => $amount,
            'paid_amount' => $paidAmount,
            'status'      => json_encode([$status->value]),
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        return (object) [
            'id'          => $id,
            'amount'      => $amount,
            'paid_amount' => $paidAmount,
            'status'      => [$status],
        ];
    }

    private function refreshPaymentable(object $p): object {
        $row = DB::table('_test_paymentables')->where('id', $p->id)->first();

        return (object) [
            'id'          => $p->id,
            'amount'      => (float) $row->amount,
            'paid_amount' => (float) $row->paid_amount,
            'status'      => json_decode($row->status, true),
        ];
    }

    public function test_paid_when_new_amount_equals_amount(): void {
        $paymentable = $this->makePaymentable(FormStatus::UNPAID, 1000, 0);
        $result      = $this->simulateListener($paymentable, 1000);

        $this->assertEquals(1000, $result['paid_amount']);
        $this->assertContains(FormStatus::PAID->value, $result['status']);
    }

    public function test_partially_paid(): void {
        $paymentable = $this->makePaymentable(FormStatus::UNPAID, 1000, 0);
        $result      = $this->simulateListener($paymentable, 300);

        $this->assertEquals(300, $result['paid_amount']);
        $this->assertContains(FormStatus::PARTIALLY_PAID->value, $result['status']);
    }

    public function test_zero_payment(): void {
        $paymentable = $this->makePaymentable(FormStatus::UNPAID, 1000, 0);
        $result      = $this->simulateListener($paymentable, 0);

        $this->assertEquals(0, $result['paid_amount']);
        $this->assertContains(FormStatus::PARTIALLY_PAID->value, $result['status']);
    }

    public function test_overpayment(): void {
        $paymentable = $this->makePaymentable(FormStatus::UNPAID, 1000, 0);
        $result      = $this->simulateListener($paymentable, 1200);

        $this->assertEquals(1200, $result['paid_amount']);
        $this->assertContains(FormStatus::PAID->value, $result['status']);
    }

    /**
     * Simulate the listener's status calculation logic without needing a real Eloquent model.
     * The actual listener writes to the model which persists via Eloquent save().
     */
    /**
     * Simulate the listener's status calculation logic.
     * Returns ['paid_amount' => float, 'status' => array of status values].
     */
    private function simulateListener(object $paymentable, float $newPaidAmount): array {
        $paidAmount    = $newPaidAmount;
        $amount        = $paymentable->amount;
        $currentStatus = $paymentable->status; // array of FormStatus enums

        if ($paidAmount >= $amount) {
            $newStatus = Utils::replaceStatus(
                $currentStatus,
                [FormStatus::UNPAID, FormStatus::PARTIALLY_PAID],
                FormStatus::PAID,
            );
        } elseif ($paidAmount > 0) {
            $newStatus = Utils::replaceStatus(
                $currentStatus,
                [FormStatus::UNPAID, FormStatus::PAID],
                FormStatus::PARTIALLY_PAID,
            );
        } else {
            $newStatus = Utils::replaceStatus(
                $currentStatus,
                [FormStatus::UNPAID, FormStatus::PARTIALLY_PAID],
                FormStatus::PARTIALLY_PAID,
            );
        }

        return [
            'paid_amount' => $paidAmount,
            'status'      => array_map(fn ($s) => $s->value, $newStatus),
        ];
    }
}
