<?php

namespace Tests\Unit\Listeners\Sales\Invoice;

use App\Events\Sales\Invoice\SalesOrderItemBillingChanged;
use App\Listeners\Sales\Invoice\UpdateSalesOrderItemBilling;
use App\Models\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class UpdateSalesOrderItemBillingTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        DB::statement('PRAGMA foreign_keys = OFF');

        if (! Schema::hasTable('_test_billing_items')) {
            Schema::create('_test_billing_items', function ($t) {
                $t->string('id', 26)->primary();
                $t->double('billed_quantity')->default(0);
                $t->double('returned_quantity')->default(0);
                $t->timestamps();
            });
        }
    }

    private function makeItem(float $billedQty = 0): object {
        $id = (string) Str::ulid();
        DB::table('_test_billing_items')->insert([
            'id'              => $id,
            'billed_quantity' => $billedQty,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        // Anonymous model mapped to test table
        $model = new class extends Model
        {
            protected $table      = '_test_billing_items';
            protected $primaryKey = 'id';
            protected $keyType    = 'string';
            public $incrementing  = false;
            protected $guarded    = [];
        };
        $model->setRawAttributes((array) DB::table('_test_billing_items')->where('id', $id)->first());
        $model->exists = true;

        return $model;
    }

    public function test_increment_billed_quantity(): void {
        $item = $this->makeItem(0);

        $event    = new SalesOrderItemBillingChanged($item, 5, 'increment');
        $listener = new UpdateSalesOrderItemBilling;
        $listener->handle($event);

        $result = DB::table('_test_billing_items')->where('id', $item->id)->first();
        $this->assertEquals(5, $result->billed_quantity);
    }

    public function test_decrement_billed_quantity(): void {
        $item = $this->makeItem(10);

        $event    = new SalesOrderItemBillingChanged($item, 5, 'decrement');
        $listener = new UpdateSalesOrderItemBilling;
        $listener->handle($event);

        $result = DB::table('_test_billing_items')->where('id', $item->id)->first();
        $this->assertEquals(5, $result->billed_quantity);
    }

    public function test_null_return_against_item_is_noop(): void {
        $item = $this->makeItem(0);

        $event    = new SalesOrderItemBillingChanged($item, 5, 'increment', null);
        $listener = new UpdateSalesOrderItemBilling;
        $listener->handle($event);

        $result = DB::table('_test_billing_items')->where('id', $item->id)->first();
        $this->assertEquals(5, $result->billed_quantity);
    }
}
