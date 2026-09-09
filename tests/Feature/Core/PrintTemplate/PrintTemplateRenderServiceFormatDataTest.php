<?php

namespace Tests\Feature\Core\PrintTemplate;

use App\Services\Core\PrintTemplate\PrintTemplateRenderService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PrintTemplateRenderServiceFormatDataTest extends TestCase {
    protected PrintTemplateRenderService $service;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('currencies')) {
            Schema::create('currencies', function (Blueprint $table): void {
                $table->string('code', 10)->primary();
                $table->string('name');
                $table->string('symbol')->nullable();
                $table->string('number_format')->nullable();
                $table->boolean('is_example')->default(false);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('preferences')) {
            Schema::create('preferences', function (Blueprint $table): void {
                $table->string('key')->primary();
                $table->text('value');
                $table->boolean('is_example')->default(false);
                $table->timestamps();
            });
        }

        DB::table('currencies')->insert([
            'code'       => 'IDR',
            'name'       => 'Indonesian Rupiah',
            'symbol'     => 'Rp',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->service = app(PrintTemplateRenderService::class);
    }

    protected function formatData(array $data, array $columns, array $opts = []): array {
        $method = new \ReflectionMethod($this->service, 'formatData');

        return $method->invoke($this->service, $data, $columns, $opts);
    }

    public function test_formats_date_column(): void {
        $result = $this->formatData(
            ['due_date' => '2026-01-15T00:00:00Z'],
            ['SalesOrder' => ['due_date' => ['type' => 'date']]],
            ['model' => 'SalesOrder', 'lang' => 'en'],
        );

        $this->assertSame('15 January 2026', $result['due_date']);
    }

    public function test_formats_boolean_column_as_checkbox_input(): void {
        $result = $this->formatData(
            ['is_paid' => true],
            ['SalesOrder' => ['is_paid' => ['type' => 'boolean']]],
            ['model' => 'SalesOrder'],
        );

        $this->assertSame("<input type='checkbox' checked>", $result['is_paid']);
    }

    public function test_formats_currency_column_with_symbol(): void {
        $result = $this->formatData(
            ['amount' => 50000, 'currency' => 'IDR'],
            ['SalesOrder' => [
                'amount'   => ['type' => 'currency', 'decimalScale' => 0],
                'currency' => ['type' => 'string'],
            ]],
            ['model' => 'SalesOrder', 'currencySymbols' => ['IDR' => 'Rp']],
        );

        $this->assertSame('Rp 50.000', $result['amount']);
    }

    public function test_formats_number_column_without_symbol(): void {
        $result = $this->formatData(
            ['quantity' => 1234.5],
            ['SalesOrder' => ['quantity' => ['type' => 'number', 'decimalScale' => 1]]],
            ['model' => 'SalesOrder'],
        );

        $this->assertSame('1.234,5', $result['quantity']);
    }

    public function test_applies_absolute_number_when_requested(): void {
        $result = $this->formatData(
            ['amount' => -500],
            ['SalesOrder' => ['amount' => ['type' => 'number', 'decimalScale' => 0]]],
            ['model' => 'SalesOrder', 'absoluteNumber' => true],
        );

        $this->assertSame('500', $result['amount']);
    }

    public function test_formats_string_column_with_parse_map(): void {
        $result = $this->formatData(
            ['status' => 'a'],
            ['SalesOrder' => ['status' => ['type' => 'string', 'parse' => ['a' => 'Active', 'b' => 'Blocked']]]],
            ['model' => 'SalesOrder'],
        );

        $this->assertSame('Active', $result['status']);
    }

    public function test_injects_1_based_idx_onto_relations_items(): void {
        $result = $this->formatData(
            ['items' => [['name' => 'A'], ['name' => 'B']]],
            [
                'SalesOrder' => ['items' => ['type' => 'relations', 'related' => 'Item']],
                'Item'       => ['name' => ['type' => 'string']],
            ],
            ['model' => 'SalesOrder'],
        );

        $this->assertSame(1, $result['items'][0]['idx']);
        $this->assertSame(2, $result['items'][1]['idx']);
    }

    public function test_returns_data_unchanged_when_model_has_no_columns_configured(): void {
        $data = ['foo' => 'bar'];

        $result = $this->formatData($data, [], ['model' => 'Unknown']);

        $this->assertSame($data, $result);
    }
}
