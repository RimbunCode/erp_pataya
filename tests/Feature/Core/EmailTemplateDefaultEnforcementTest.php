<?php

namespace Tests\Feature\Core;

use App\Models\Core\EmailTemplate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EmailTemplateDefaultEnforcementTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // Global scope HasExampleData butuh kolom is_example (ditambah via initPermissions di prod).
        if (Schema::hasTable('email_templates') && ! Schema::hasColumn('email_templates', 'is_example')) {
            Schema::table('email_templates', fn ($t) => $t->boolean('is_example')->default(false));
        }
    }

    public function test_first_template_for_a_model_becomes_default_automatically(): void {
        $template = EmailTemplate::factory()->create([
            'model'      => 'App\\Models\\Sales\\SalesOrder',
            'is_default' => false,
        ]);

        $this->assertTrue($template->fresh()->is_default);
    }

    public function test_setting_a_new_default_demotes_the_previous_default(): void {
        $first = EmailTemplate::factory()->create([
            'model'      => 'App\\Models\\Sales\\SalesOrder',
            'is_default' => true,
        ]);

        $second = EmailTemplate::factory()->create([
            'model'      => 'App\\Models\\Sales\\SalesOrder',
            'is_default' => true,
        ]);

        $this->assertFalse($first->fresh()->is_default);
        $this->assertTrue($second->fresh()->is_default);
    }

    public function test_non_default_template_stays_non_default_when_siblings_exist(): void {
        EmailTemplate::factory()->create([
            'model'      => 'App\\Models\\Sales\\SalesOrder',
            'is_default' => true,
        ]);

        $second = EmailTemplate::factory()->create([
            'model'      => 'App\\Models\\Sales\\SalesOrder',
            'is_default' => false,
        ]);

        $this->assertFalse($second->fresh()->is_default);
    }

    public function test_default_enforcement_is_scoped_per_model(): void {
        $salesOrderDefault = EmailTemplate::factory()->create([
            'model'      => 'App\\Models\\Sales\\SalesOrder',
            'is_default' => true,
        ]);

        $invoiceDefault = EmailTemplate::factory()->create([
            // Class asli App\Models\Finances\SalesInvoice -- sebelumnya
            // "App\Models\Sales\Invoice" (typo, class tidak pernah ada),
            // lolos diam-diam krn accessor title() dulu tidak divalidasi
            // class_exists(). Sekarang RecordAuditLog men-serialize model
            // (termasuk $appends) saat create, jadi typo ini bikin fatal
            // "Class ... not found" alih-alih silently correct.
            'model'      => 'App\\Models\\Finances\\SalesInvoice',
            'is_default' => true,
        ]);

        $this->assertTrue($salesOrderDefault->fresh()->is_default);
        $this->assertTrue($invoiceDefault->fresh()->is_default);
    }
}
