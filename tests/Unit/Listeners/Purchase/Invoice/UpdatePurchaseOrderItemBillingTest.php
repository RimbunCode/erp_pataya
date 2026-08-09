<?php

namespace Tests\Unit\Listeners\Purchase\Invoice;

use App\Events\Purchase\Invoice\PurchaseOrderItemBillingChanged;
use App\Listeners\Purchase\Invoice\UpdatePurchaseOrderItemBilling;
use App\Models\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class UpdatePurchaseOrderItemBillingTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        DB::statement('PRAGMA foreign_keys = OFF');

        if (! Schema::hasTable('_test_po_billing_items')) {
            Schema::create('_test_po_billing_items', function ($t) {
                $t->string('id', 26)->primary();
                $t->double('billed_quantity')->default(0);
                $t->double('returned_quantity')->default(0);
                $t->timestamps();
            });
        }
    }

    private function makeItem(float $billedQty = 0): object {
        $id = (string) Str::ulid();
        DB::table('_test_po_billing_items')->insert([
            'id'              => $id,
            'billed_quantity' => $billedQty,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        $model = new class extends Model
        {
            protected $table      = '_test_po_billing_items';
            protected $primaryKey = 'id';
            protected $keyType    = 'string';
            public $incrementing  = false;
            protected $guarded    = [];
        };
        $model->setRawAttributes((array) DB::table('_test_po_billing_items')->where('id', $id)->first());
        $model->exists = true;

        return $model;
    }

    public function test_increment_billed_quantity(): void {
        $item = $this->makeItem(0);

        $event    = new PurchaseOrderItemBillingChanged($item, 5, 'increment');
        $listener = new UpdatePurchaseOrderItemBilling;
        $listener->handle($event);

        $result = DB::table('_test_po_billing_items')->where('id', $item->id)->first();
        $this->assertEquals(5, $result->billed_quantity);
    }

    public function test_decrement_billed_quantity(): void {
        $item = $this->makeItem(10);

        $event    = new PurchaseOrderItemBillingChanged($item, 5, 'decrement');
        $listener = new UpdatePurchaseOrderItemBilling;
        $listener->handle($event);

        $result = DB::table('_test_po_billing_items')->where('id', $item->id)->first();
        $this->assertEquals(5, $result->billed_quantity);
    }
}
