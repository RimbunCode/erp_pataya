<?php

namespace Tests\Feature\Report;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReportViewSchemaTest extends TestCase {
    use RefreshDatabase;

    public function test_report_views_are_queryable_immediately_after_migrations(): void {
        foreach ([
            'report_stock_balances',
            'report_stock_mutations',
            'report_sales',
            'report_purchases',
            'report_sales_invoices',
            'report_purchase_invoices',
            'report_work_orders',
            'report_sparepart_usages',
            'report_team_activities',
        ] as $view) {
            $this->assertIsArray(DB::select("SELECT * FROM {$view} LIMIT 0"), $view);
        }
    }
}
