<?php

namespace Tests\Feature\Finances;

use App\Http\Requests\Finances\Rules\ReturnAgainstItemRules;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
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
            $table->timestamp('deleted_at')->nullable();
        });
        DB::table('zz_return_items')->insert([
            ['id' => 'row-a', 'invoice_id' => 'inv-1', 'quantity' => 10, 'returned_quantity' => 4],
            ['id' => 'row-b', 'invoice_id' => 'inv-2', 'quantity' => 10, 'returned_quantity' => 0],
        ]);
    }

    protected function tearDown(): void {
        Schema::dropIfExists('zz_return_items');
        parent::tearDown();
    }

    /**
     * @param  list<array<string,mixed>>  $rows
     */
    private function validateRows(array $rows, ?string $returnAgainst = 'inv-1'): ValidatorInstance {
        $validator = Validator::make([], []);
        ReturnAgainstItemRules::validate($validator, $rows, $returnAgainst, 'zz_return_items', 'invoice_id');

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
    public function ignores_rows_without_a_return_source(): void {
        $this->assertTrue($this->validateRows([['quantity' => 99]])->errors()->isEmpty());
    }
}
