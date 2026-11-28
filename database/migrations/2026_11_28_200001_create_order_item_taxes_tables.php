<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pajak majemuk per item Quotation, Sales Order, dan Purchase Order (spek finance-multi-tax-per-item, Task 9.1;
 * Requirement 14.1). Bentuk sama dengan pivot invoice (`2026_11_28_100001`): satu baris per pasangan (item, pajak),
 * kolom item lama (`tax_id`, `tax_rate`, `tax_amount`, `amount`) menjadi cermin Pajak Utama (`position` 0) dan agregat.
 *
 * Aditif: tidak menyentuh kolom item. Nama indeks unik dipendekkan eksplisit karena nama bawaan melebihi batas 64
 * karakter MySQL. `tax_rule_version_id` tanpa FK, sama seperti pivot invoice.
 *
 * `down()` menghapus ketiga tabel (data pajak per pasangan hilang; kolom item tidak berubah). Urutan rollback:
 * migrasi backfill dahulu, lalu migrasi ini.
 */
return new class extends Migration
{
    /** @var array<string, array{item: string, fk: string, short: string}> */
    private const TABLES = [
        'quotation_item_taxes'      => ['item' => 'quotation_items', 'fk' => 'quotation_item_id', 'short' => 'qt'],
        'sales_order_item_taxes'    => ['item' => 'sales_order_items', 'fk' => 'sales_order_item_id', 'short' => 'so'],
        'purchase_order_item_taxes' => ['item' => 'purchase_order_items', 'fk' => 'purchase_order_item_id', 'short' => 'po'],
    ];

    public function up(): void {
        foreach (self::TABLES as $name => $config) {
            $short = $config['short'];

            Schema::create($name, function (Blueprint $table) use ($config, $short) {
                $table->ulid('id')->primary();
                $table->foreignUlid($config['fk'])->constrained($config['item'], 'id', "{$short}_item_taxes_item_fk")->cascadeOnDelete();
                $table->foreignUlid('tax_id')->constrained('taxes', 'id', "{$short}_item_taxes_tax_fk");
                $table->ulid('tax_rule_version_id')->nullable();
                $table->unsignedTinyInteger('position')->default(0);
                $table->decimal('tax_rate', 9, 4)->default(0);
                $table->decimal('dpp_factor', 12, 8)->default(1);
                $table->double('base_amount')->default(0);
                $table->double('dpp_amount')->default(0);
                $table->double('tax_amount')->default(0);
                $table->double('withholding_amount')->default(0);
                $table->timestamps();

                $table->unique([$config['fk'], 'tax_id'], "{$short}_item_taxes_item_tax_unique");
                $table->index('tax_id', "{$short}_item_taxes_tax_index");
            });
        }
    }

    public function down(): void {
        foreach (array_reverse(array_keys(self::TABLES)) as $name) {
            Schema::dropIfExists($name);
        }
    }
};
