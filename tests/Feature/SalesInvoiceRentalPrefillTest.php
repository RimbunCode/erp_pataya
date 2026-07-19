<?php

namespace Tests\Feature;

use App\Models\Sales\SalesOrder;
use App\Models\Sales\SalesOrderItem;
use App\Services\Sales\RentalDurationService;
use App\Utils;
use Carbon\Carbon;
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Menguji logic mapping item rental di SalesInvoiceController::create() (baris ~90-107)
 * secara terisolasi -- BUKAN lewat HTTP request penuh, karena controller memanggil query
 * `whereRaw('json_overlaps(...)')` (baris ~47) yang MySQL-only dan tidak didukung SQLite
 * (test environment project ini). Ini bug infrastruktur test pre-existing, di luar scope
 * spec rental-actual-duration -- lihat catatan yang sama di spec invoice-dpp-adjustment
 * soal SalesOrderFactory usang dan MySQL80 zombie.
 *
 * Test ini mereplikasi persis logic mapping (bukan memanggil method controller), untuk
 * membuktikan behavior yang sama: price di-override untuk SO rental, tidak berubah untuk
 * SO non-rental.
 */
class SalesInvoiceRentalPrefillTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    private function makeSalesOrder(bool $isRent, float $price = 3_000_000): SalesOrder {
        $itemVariant = ItemVariantFactory::new()->create();

        $salesOrderId = (string) Str::ulid();
        DB::table('sales_orders')->insert([
            'id'         => $salesOrderId,
            'date'       => now(),
            'is_rent'    => $isRent,
            'amount'     => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('sales_order_items')->insert([
            'id'             => (string) Str::ulid(),
            'sales_order_id' => $salesOrderId,
            'item_id'        => $itemVariant->id,
            'quantity'       => 1,
            'price'          => $price,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        return SalesOrder::find($salesOrderId);
    }

    private function makePermissionId(): string {
        $permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'         => $permissionId,
            'module'     => 'inventory',
            'name'       => 'dn_test_' . $permissionId,
            'model'      => 'App\\Models\\Inventory\\DeliveryNote',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $permissionId;
    }

    /**
     * Replikasi persis mapping items di SalesInvoiceController::create().
     */
    private function mapItems(SalesOrder $so, ?Carbon $rentalCutoffDate): array {
        $rentalDurationService = app(RentalDurationService::class);

        return $so->items->map(function ($item) use ($so, $rentalDurationService, $rentalCutoffDate) {
            $itemData = [
                ...$item->toArray(),
                'id'                  => Utils::generateRandom(5),
                'sales_order_item_id' => $item->id,
            ];

            if ($so->is_rent) {
                $duration  = $rentalDurationService->calculateDuration($item, $rentalCutoffDate);
                $totalDays = collect($duration['segments'])->sum('duration_days');

                $itemData['price']                = $rentalDurationService->calculateAmount($item->price, $totalDays);
                $itemData['rental_duration_days'] = $totalDays;
                $itemData['rental_status']        = $duration['status'];
            }

            return $itemData;
        })->toArray();
    }

    public function test_rental_sales_order_prefills_price_from_duration_calculation(): void {
        $so     = $this->makeSalesOrder(isRent: true, price: 3_000_000);
        $soItem = $so->items->first();

        $deliveryNoteId = (string) Str::ulid();
        DB::table('delivery_notes')->insert([
            'id'                 => $deliveryNoteId,
            'delivery_date'      => '2026-08-01',
            'reference_to_id'    => $this->makePermissionId(),
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $so->id,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);
        DB::table('delivery_note_items')->insert([
            'id'                 => (string) Str::ulid(),
            'delivery_note_id'   => $deliveryNoteId,
            'referenceable_type' => SalesOrderItem::class,
            'referenceable_id'   => $soItem->id,
            'item_id'            => $soItem->item_id,
            'valuation_rates'    => json_encode([]),
            'quantity'           => 1,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        // 45 hari sejak 2026-08-01 -> cutoff 2026-09-14 (1 bulan penuh + 15 hari)
        $items = $this->mapItems($so->fresh(), Carbon::parse('2026-09-14'));

        $expectedPrice = 3_000_000 + 15 * (3_000_000 / 30);
        $this->assertEqualsWithDelta($expectedPrice, $items[0]['price'], 0.01);
        $this->assertSame(45, $items[0]['rental_duration_days']);
        $this->assertSame('running', $items[0]['rental_status']);
    }

    public function test_non_rental_sales_order_price_is_unchanged(): void {
        $so    = $this->makeSalesOrder(isRent: false, price: 3_000_000);
        $items = $this->mapItems($so->fresh(), null);

        $this->assertSame(3_000_000.0, $items[0]['price']);
        $this->assertArrayNotHasKey('rental_duration_days', $items[0]);
        $this->assertArrayNotHasKey('rental_status', $items[0]);
    }
}
