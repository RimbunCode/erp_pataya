<?php

namespace Tests\Unit\Listeners\Sales\Invoice;

use App\Events\Sales\Invoice\SalesInvoiceReturnStatusChanged;
use App\Listeners\Sales\Invoice\UpdateSalesInvoiceReturnStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class UpdateSalesInvoiceReturnStatusTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        DB::statement('PRAGMA foreign_keys = OFF');

        if (! Schema::hasTable('_test_return_against')) {
            Schema::create('_test_return_against', function ($t) {
                $t->string('id', 26)->primary();
                $t->json('status')->nullable();
                $t->timestamps();
            });
        }
    }

    public function test_updates_return_against_status(): void {
        $id = (string) Str::ulid();
        DB::table('_test_return_against')->insert([
            'id'         => $id,
            'status'     => json_encode(['unpaid']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $model = new class extends Model
        {
            protected $table      = '_test_return_against';
            protected $primaryKey = 'id';
            protected $keyType    = 'string';
            public $incrementing  = false;
            protected $guarded    = [];
        };
        $model->setRawAttributes((array) DB::table('_test_return_against')->where('id', $id)->first());
        $model->exists = true;

        $newStatus = ['paid'];

        $event    = new SalesInvoiceReturnStatusChanged($model, $newStatus);
        $listener = new UpdateSalesInvoiceReturnStatus;
        $listener->handle($event);

        $result = DB::table('_test_return_against')->where('id', $id)->first();
        $this->assertEquals($newStatus, json_decode($result->status, true));
    }
}
