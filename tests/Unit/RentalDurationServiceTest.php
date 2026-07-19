<?php

namespace Tests\Unit;

use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Services\Sales\RentalDurationService;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class RentalDurationServiceTest extends TestCase {
    public function test_sales_order_item_has_delivery_note_items_relation(): void {
        $item = new SalesOrderItem;

        $this->assertTrue(method_exists($item, 'deliveryNoteItems'));
    }

    #[DataProvider('amountProvider')]
    public function test_calculate_amount_formula(int $durationDays, float $monthlyRate, float $expected): void {
        $service = new RentalDurationService;

        $this->assertEqualsWithDelta($expected, $service->calculateAmount($monthlyRate, $durationDays), 0.001);
    }

    public static function amountProvider(): array {
        return [
            '1 hari'                                           => [1, 3_000_000, 3_000_000 / 30 * 1],
            '15 hari (setengah bulan)'                         => [15, 3_000_000, 3_000_000 / 30 * 15],
            'tepat 30 hari (1 bulan)'                          => [30, 3_000_000, 3_000_000],
            '31 hari (1 bulan + 1 hari)'                       => [31, 3_000_000, 3_000_000 + (3_000_000 / 30)],
            '45 hari (contoh requirements: 1 bulan + 15 hari)' => [45, 3_000_000, 3_000_000 + (15 * (3_000_000 / 30))],
            '60 hari (2 bulan penuh)'                          => [60, 3_000_000, 2 * 3_000_000],
        ];
    }

    public function test_calculate_amount_is_continuous_at_30_31_day_boundary(): void {
        $service = new RentalDurationService;

        $amount30 = $service->calculateAmount(3_000_000, 30);
        $amount31 = $service->calculateAmount(3_000_000, 31);

        $this->assertEqualsWithDelta(3_000_000, $amount30, 0.001);
        $this->assertEqualsWithDelta($amount30 + (3_000_000 / 30), $amount31, 0.001, 'Tidak boleh ada lompatan nilai di titik potong 30/31 hari');
    }

    public function test_diff_in_days_inclusive_same_date_is_one_day(): void {
        $service = new RentalDurationService;
        $date    = Carbon::parse('2026-08-01');

        $this->assertSame(1, $service->diffInDaysInclusive($date, $date));
    }

    public function test_diff_in_days_inclusive_example_from_requirements(): void {
        $service = new RentalDurationService;
        $start   = Carbon::parse('2026-08-01');
        $end     = Carbon::parse('2026-08-05');

        // Contoh dari requirements.md: keluar 1 Agustus, kembali 5 Agustus -> 5 hari (bukan 4)
        $this->assertSame(5, $service->diffInDaysInclusive($start, $end));
    }

    public function test_rental_durations_accessor_returns_null_for_non_rental_sales_order(): void {
        $salesOrder = new SalesOrder;
        $salesOrder->setRawAttributes(['is_rent' => false]);

        $this->assertNull($salesOrder->rental_durations);
    }
}
