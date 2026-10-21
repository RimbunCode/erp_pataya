<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Events\Asset\FixedAssetItemApproved;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Purchase\Order\PurchaseOrderBillStatusRecalculationRequested;
use App\Events\Purchase\Order\PurchaseOrderReceiveStatusRecalculationRequested;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Events\Purchase\Request\PurchaseRequestReceiveStatusRecalculationRequested;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use App\Services\Purchase\PurchaseReceiptService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Spec document-connection-coverage, FR3: retur penerimaan tercatat sebagai koneksi
 * ke receipt yang diretur. Koneksi ke PurchaseOrder tetap ada.
 */
class PurchaseReceiptReturnConnectionTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private PurchaseOrder $po;

    protected function setUp(): void {
        parent::setUp();

        foreach ([FormatingSeries::class, Supplier::class, PurchaseOrder::class, PurchaseReceipt::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        CountryFactory::new()->create(['code' => 'IDN']);

        Event::fake([
            PurchaseReceiptGeneralLedgerPostingRequested::class,
            PurchaseOrderReceiveStatusRecalculationRequested::class,
            PurchaseRequestReceiveStatusRecalculationRequested::class,
            FixedAssetItemApproved::class,
            PurchaseInvoiceGeneralLedgerPostingRequested::class,
            PurchaseOrderBillStatusRecalculationRequested::class,
        ]);

        $this->user = User::factory()->create();
        $this->actingAs($this->user);

        $supplier = SupplierFactory::new()->create();
        $this->po = BaseModel::withoutEvents(fn () => PurchaseOrderFactory::new()->create([
            'supplier_id' => $supplier->id,
            'status'      => [FormStatus::SUBMITTED],
        ]));
    }

    private function makeReceipt(array $over = []): PurchaseReceipt {
        // Kode receipt dibentuk FormatingSeries dari @[branch.code], jadi cabang wajib ada.
        $branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB', 'is_main_branch' => true]);

        return BaseModel::withoutEvents(fn () => PurchaseReceipt::create(array_merge([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'branch_id'         => $branch->id,
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'created_by_id'     => $this->user->id,
        ], $over)));
    }

    #[Test]
    public function return_receipt_records_connection_to_returned_receipt(): void {
        $original = $this->makeReceipt();
        $return   = $this->makeReceipt(['return_against_id' => $original->id]);

        app(PurchaseReceiptService::class)->submit($return);

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', PurchaseReceipt::class)
                ->where('model_id', $original->id)
                ->where('reference_type', PurchaseReceipt::class)
                ->where('reference_id', $return->id)
                ->exists(),
            'Retur harus tercatat sebagai koneksi ke receipt asal.',
        );
    }

    #[Test]
    public function existing_connection_to_purchase_order_is_kept(): void {
        $return = $this->makeReceipt(['return_against_id' => $this->makeReceipt()->id]);

        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $this->po->id,
            'reference_type' => PurchaseReceipt::class,
            'reference_id'   => $return->id,
        ]);

        app(PurchaseReceiptService::class)->submit($return);

        $this->assertTrue(
            ModelConnection::query()
                ->where('model_type', PurchaseOrder::class)
                ->where('model_id', $this->po->id)
                ->where('reference_type', PurchaseReceipt::class)
                ->where('reference_id', $return->id)
                ->exists(),
            'Koneksi ke PurchaseOrder yang sudah ada tidak boleh hilang.',
        );
    }

    #[Test]
    public function receipt_without_return_against_writes_no_return_connection(): void {
        $receipt = $this->makeReceipt();

        app(PurchaseReceiptService::class)->submit($receipt);

        $this->assertFalse(
            ModelConnection::query()
                ->where('reference_type', PurchaseReceipt::class)
                ->where('reference_id', $receipt->id)
                ->where('model_type', PurchaseReceipt::class)
                ->exists(),
        );
    }

    #[Test]
    public function submit_twice_does_not_duplicate_return_connection(): void {
        $original = $this->makeReceipt();
        $return   = $this->makeReceipt(['return_against_id' => $original->id]);

        $service = app(PurchaseReceiptService::class);
        $service->submit($return);
        $countAfterFirst = DB::table('model_connections')->count();

        $service->submit($return);

        $this->assertSame($countAfterFirst, DB::table('model_connections')->count());
    }
}
