<?php

namespace Tests\Feature\Migration;

use App\Models\Finances\SalesInvoice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class NormalizeSalesInvoicePrintTemplateRelationsMigrationTest extends TestCase {
    use RefreshDatabase;

    private function migration(): object {
        return require database_path('migrations/2026_10_11_110219_normalize_sales_invoice_print_template_relations.php');
    }

    public function test_normalizes_only_active_sales_invoice_templates_idempotently(): void {
        $salesInvoiceId = (string) Str::ulid();
        $otherId        = (string) Str::ulid();
        $deletedId      = (string) Str::ulid();
        $oldRelations   = json_encode(['customer_branch', 'sales_order']);

        DB::table('print_templates')->insert([
            [
                'id'             => $salesInvoiceId,
                'name'           => 'Sales Invoice',
                'model'          => SalesInvoice::class,
                'used_relations' => $oldRelations,
                'deleted_at'     => null,
                'created_at'     => now(),
                'updated_at'     => now(),
            ],
            [
                'id'             => $otherId,
                'name'           => 'Other',
                'model'          => 'App\\Models\\Sales\\SalesOrder',
                'used_relations' => $oldRelations,
                'deleted_at'     => null,
                'created_at'     => now(),
                'updated_at'     => now(),
            ],
            [
                'id'             => $deletedId,
                'name'           => 'Deleted Invoice',
                'model'          => SalesInvoice::class,
                'used_relations' => $oldRelations,
                'deleted_at'     => now(),
                'created_at'     => now(),
                'updated_at'     => now(),
            ],
        ]);

        $migration = $this->migration();
        $migration->up();
        $migration->up();

        $this->assertSame([
            'customerBranch',
            'salesOrder',
            'currency',
        ], json_decode((string) DB::table('print_templates')->where('id', $salesInvoiceId)->value('used_relations'), true));
        $this->assertSame($oldRelations, DB::table('print_templates')->where('id', $otherId)->value('used_relations'));
        $this->assertSame($oldRelations, DB::table('print_templates')->where('id', $deletedId)->value('used_relations'));
    }
}
