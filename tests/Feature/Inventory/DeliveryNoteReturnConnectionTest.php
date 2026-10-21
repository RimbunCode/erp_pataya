<?php

namespace Tests\Feature\Inventory;

use App\Events\Asset\AssetRentalDeliveryApproved;
use App\Events\Asset\AssetRentalReturnApproved;
use App\Events\Asset\AssetSoldViaDelivery;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Events\Sales\Order\DocumentDeliveryStatusRecalculationRequested;
use App\Models\Asset\Asset;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Services\Inventory\DeliveryNoteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec document-connection-coverage, FR3: retur pengiriman tercatat sebagai koneksi
 * ke delivery note yang diretur.
 */
class DeliveryNoteReturnConnectionTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Branch $branch;
    private Customer $customer;
    private string $referenceToId;
    private SalesOrder $salesOrder;

    protected function setUp(): void {
        parent::setUp();

        // SQLite test tidak punya json_overlaps (fungsi MySQL). Dipakai DeliveryNoteService::submit()
        // untuk membatalkan draft lain; shim ini meniru irisan dua array JSON.
        DB::connection()->getPdo()->sqliteCreateFunction('json_overlaps', function (?string $a, ?string $b): int {
            $left  = json_decode($a ?? '[]', true) ?? [];
            $right = json_decode($b ?? '[]', true) ?? [];

            return array_intersect($left, $right) !== [] ? 1 : 0;
        }, 2);

        foreach ([User::class, FormatingSeries::class, DeliveryNote::class, Asset::class, SalesOrder::class, StockLedgerEntry::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Event::fake([
            DeliveryNoteGeneralLedgerPostingRequested::class,
            DocumentDeliveryStatusRecalculationRequested::class,
            AssetRentalDeliveryApproved::class,
            AssetRentalReturnApproved::class,
            AssetSoldViaDelivery::class,
        ]);

        $this->user          = User::factory()->create();
        $this->branch        = Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);
        $this->customer      = Customer::query()->create(['name' => 'Z', 'is_disabled' => false]);
        $this->referenceToId = Permission::create([
            'module' => 'inventory',
            'name'   => 'dn_' . fake()->unique()->numerify('####'),
            'model'  => SalesOrder::class,
        ])->id;
        $this->salesOrder = SalesOrder::create([
            'code'          => fake()->unique()->bothify('SO-####'),
            'date'          => now(),
            'customer_id'   => $this->customer->id,
            'created_by_id' => $this->user->id,
        ]);
        Auth::login($this->user);
    }

    private function makeDeliveryNote(array $over = []): DeliveryNote {
        return DeliveryNote::create(array_merge([
            'code'               => fake()->unique()->bothify('DN-####'),
            'referenceable_type' => SalesOrder::class,
            'referenceable_id'   => $this->salesOrder->id,
            'reference_to_id'    => $this->referenceToId,
            'branch_id'          => $this->branch->id,
            'customer_id'        => $this->customer->id,
            'date'               => now(),
            'delivery_date'      => now(),
            'created_by_id'      => $this->user->id,
        ], $over));
    }

    #[Test]
    public function return_delivery_note_records_connection_to_returned_delivery_note(): void {
        $original = $this->makeDeliveryNote();
        $return   = $this->makeDeliveryNote(['return_against_id' => $original->id]);

        app(DeliveryNoteService::class)->submit($return);

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', DeliveryNote::class)
                ->where('model_id', $original->id)
                ->where('reference_type', DeliveryNote::class)
                ->where('reference_id', $return->id)
                ->exists(),
            'Retur harus tercatat sebagai koneksi ke delivery note asal.',
        );
    }

    #[Test]
    public function existing_connection_to_parent_is_kept(): void {
        $parent = $this->makeDeliveryNote();
        $return = $this->makeDeliveryNote(['return_against_id' => $this->makeDeliveryNote()->id]);

        ModelConnection::create([
            'model_type'     => DeliveryNote::class,
            'model_id'       => $parent->id,
            'reference_type' => DeliveryNote::class,
            'reference_id'   => $return->id,
        ]);

        app(DeliveryNoteService::class)->submit($return);

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', DeliveryNote::class)
                ->where('model_id', $parent->id)
                ->where('reference_type', DeliveryNote::class)
                ->where('reference_id', $return->id)
                ->exists(),
            'Koneksi lama tidak boleh hilang.',
        );
    }

    #[Test]
    public function delivery_note_without_return_against_writes_no_return_connection(): void {
        $deliveryNote = $this->makeDeliveryNote();

        app(DeliveryNoteService::class)->submit($deliveryNote);

        // Koneksi ke SalesOrder (referenceable) tetap dicatat DocumentSubmitted; yang
        // diuji di sini hanya tautan retur: model = DN lain, reference = DN ini.
        $this->assertFalse(
            ModelConnection::query()
                ->where('model_type', DeliveryNote::class)
                ->where('reference_type', DeliveryNote::class)
                ->where('reference_id', $deliveryNote->id)
                ->exists(),
        );
    }

    #[Test]
    public function submit_twice_does_not_duplicate_return_connection(): void {
        $original = $this->makeDeliveryNote();
        $return   = $this->makeDeliveryNote(['return_against_id' => $original->id]);

        $service = app(DeliveryNoteService::class);
        $service->submit($return);
        $countAfterFirst = DB::table('model_connections')->count();

        $service->submit($return);

        $this->assertSame($countAfterFirst, DB::table('model_connections')->count());
    }
}
