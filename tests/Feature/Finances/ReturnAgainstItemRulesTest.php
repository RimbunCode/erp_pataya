<?php

namespace Tests\Feature\Finances;

use App\Http\Requests\Finances\Rules\ReturnAgainstItemRules;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator as ValidatorInstance;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ReturnAgainstItemRulesTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        Schema::create('zz_return_items', function ($table): void {
            $table->string('id')->primary();
            $table->string('invoice_id');
            $table->double('quantity');
            $table->double('returned_quantity')->default(0);
            $table->string('item_id')->nullable();
            $table->string('item_unit_id')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });
        Schema::create('zz_return_docs', function ($table): void {
            $table->string('id')->primary();
            $table->json('status');
            $table->string('return_against_id')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });
        DB::table('zz_return_items')->insert([
            ['id' => 'row-a', 'invoice_id' => 'inv-1', 'quantity' => 10, 'returned_quantity' => 4, 'item_id' => 'item-1', 'item_unit_id' => 'unit-1'],
            ['id' => 'row-b', 'invoice_id' => 'inv-2', 'quantity' => 10, 'returned_quantity' => 0, 'item_id' => 'item-2', 'item_unit_id' => 'unit-1'],
        ]);
        DB::table('zz_return_docs')->insert([
            ['id' => 'inv-1', 'status' => json_encode(['unpaid']), 'return_against_id' => null, 'canceled_at' => null],
            ['id' => 'inv-draft', 'status' => json_encode(['draft']), 'return_against_id' => null, 'canceled_at' => null],
            ['id' => 'inv-canceled', 'status' => json_encode(['unpaid']), 'return_against_id' => null, 'canceled_at' => now()],
            ['id' => 'inv-return', 'status' => json_encode(['returned']), 'return_against_id' => 'inv-1', 'canceled_at' => null],
        ]);
    }

    protected function tearDown(): void {
        Schema::dropIfExists('zz_return_items');
        Schema::dropIfExists('zz_return_docs');
        parent::tearDown();
    }

    /**
     * @param  list<array<string,mixed>>  $rows
     */
    private function validateRows(array $rows, ?string $returnAgainst = 'inv-1'): ValidatorInstance {
        $validator = Validator::make([], []);
        ReturnAgainstItemRules::validate($validator, $rows, $returnAgainst, 'zz_return_items', 'invoice_id', 'zz_return_docs', ['item.id' => 'item_id', 'unit.id' => 'item_unit_id']);

        return $validator;
    }

    #[Test]
    public function accepts_a_row_within_the_remaining_quantity(): void {
        $this->assertTrue($this->validateRows([['return_against_item_id' => 'row-a', 'quantity' => 6]])->errors()->isEmpty());
    }

    #[Test]
    public function rejects_a_row_that_belongs_to_another_invoice(): void {
        $errors = $this->validateRows([['return_against_item_id' => 'row-b', 'quantity' => 1]])->errors();

        $this->assertTrue($errors->has('items.0.return_against_item_id'));
    }

    #[Test]
    public function rejects_quantity_above_the_remaining_quantity_including_split_rows(): void {
        $errors = $this->validateRows([
            ['return_against_item_id' => 'row-a', 'quantity' => 4],
            ['return_against_item_id' => 'row-a', 'quantity' => 3],
        ])->errors();

        $this->assertFalse($errors->has('items.0.quantity'));
        $this->assertTrue($errors->has('items.1.quantity'));
    }

    #[Test]
    public function rejects_a_return_source_on_a_non_return_document(): void {
        $errors = $this->validateRows([['return_against_item_id' => 'row-a', 'quantity' => 1]], null)->errors();

        $this->assertTrue($errors->has('items.0.return_against_item_id'));
    }

    #[Test]
    public function requires_a_source_row_on_every_return_row(): void {
        $errors = $this->validateRows([['quantity' => 99]])->errors();

        $this->assertTrue($errors->has('items.0.return_against_item_id'));
    }

    #[Test]
    public function rejects_a_row_whose_item_or_unit_differs_from_the_source_row(): void {
        $errors = $this->validateRows([
            ['return_against_item_id' => 'row-a', 'quantity' => 1, 'item' => ['id' => 'item-2']],
            ['return_against_item_id' => 'row-a', 'quantity' => 1, 'unit' => ['id' => 'unit-9']],
            ['return_against_item_id' => 'row-a', 'quantity' => 1, 'item' => ['id' => 'item-1'], 'unit' => ['id' => 'unit-1']],
        ])->errors();

        $this->assertTrue($errors->has('items.0.item.id'));
        $this->assertTrue($errors->has('items.1.unit.id'));
        $this->assertFalse($errors->has('items.2.item.id'));
        $this->assertFalse($errors->has('items.2.unit.id'));
    }

    #[Test]
    public function rejects_returning_against_an_unapproved_canceled_or_return_invoice(): void {
        foreach (['inv-draft', 'inv-canceled', 'inv-return'] as $invoice) {
            $errors = $this->validateRows([], $invoice)->errors();
            $this->assertTrue($errors->has('return_against.id'), $invoice);
        }
        $this->assertFalse($this->validateRows([], 'inv-1')->errors()->has('return_against.id'));
    }

    #[Test]
    public function approve_time_check_rejects_quantity_above_what_is_left(): void {
        ReturnAgainstItemRules::assertRemainingOnApprove('zz_return_items', 'row-a', 6);
        $this->addToAssertionCount(1);

        $this->expectException(ValidationException::class);
        ReturnAgainstItemRules::assertRemainingOnApprove('zz_return_items', 'row-a', 7);
    }
}
