<?php

namespace Tests\Feature\Core\PrintTemplate;

use App\Models\Core\PrintTemplate;
use App\Models\CRM\Quotation;
use App\Models\Finances\SalesInvoice;
use App\Services\Core\PrintTemplate\PrintTemplateRenderService;
use App\Services\Core\PrintTemplate\RelationTrackerService;
use App\Traits\Submitable;
use Database\Seeders\StandardPrintTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\PrintTemplateFieldChecker;
use Tests\TestCase;

class StandardPrintTemplateSeederTest extends TestCase {
    use RefreshDatabase;

    /** @var array<string, string> model => id permission */
    private array $permissionIds = [];

    protected function setUp(): void {
        parent::setUp();

        // Kolom `code` milik Submitable ada di database produksi tetapi tidak
        // dibuat oleh migration create_* untuk tabel lama. Tanpa ini daftar
        // kolom model di test lebih sempit dari yang dilihat renderer, dan
        // `doc.code` tampak "tidak ada".
        $tables = collect(StandardPrintTemplateSeeder::definitions())
            ->map(fn (array $definition) => (new $definition['model'])->getTable())
            ->push('sales_orders', 'purchase_orders')
            ->unique();

        foreach ($tables as $table) {
            if (! Schema::hasColumn($table, 'code')) {
                Schema::table($table, fn ($blueprint) => $blueprint->string('code')->nullable());
            }
        }

        foreach (StandardPrintTemplateSeeder::definitions() as $definition) {
            $id = (string) Str::ulid();
            DB::table('permissions')->insert([
                'id'                 => $id,
                'module'             => 'test',
                'name'               => Str::plural($definition['label']),
                'model'              => $definition['model'],
                'route'              => 'test',
                'permissions'        => '[]',
                'is_submitable'      => 1,
                'allow_only_creator' => 0,
                'created_at'         => now(),
                'updated_at'         => now(),
            ]);
            $this->permissionIds[$definition['model']] = $id;
        }
    }

    /**
     * Template "Default - X" buatan tangan milik user: satu per model,
     * berstatus default.
     *
     * @return array<string, PrintTemplate> model => template
     */
    private function makeHandmadeDefaults(): array {
        $templates = [];

        foreach (StandardPrintTemplateSeeder::definitions() as $definition) {
            $templates[$definition['model']] = PrintTemplate::create([
                'name'       => 'Default - ' . $definition['label'],
                'model'      => $definition['model'],
                'name_model' => Str::plural($definition['label']),
                'is_default' => true,
                'html'       => "<body>\n  <p>buatan tangan</p>\n</body>\n",
                'css'        => 'body { color: red; }',
                'template'   => ['pages' => []],
            ]);
        }

        return $templates;
    }

    private function seedStandard(): void {
        $this->seed(StandardPrintTemplateSeeder::class);
    }

    private function standardTemplate(string $label): PrintTemplate {
        return PrintTemplate::where('name', StandardPrintTemplateSeeder::nameFor($label))->firstOrFail();
    }

    #[Test]
    public function creates_one_template_per_submitable_model(): void {
        $this->seedStandard();

        $definitions = StandardPrintTemplateSeeder::definitions();

        $this->assertCount(16, $definitions);
        $this->assertSame(16, PrintTemplate::where('name', 'like', 'Standar - %')->count());
        $this->assertCount(16, array_unique(array_column($definitions, 'model')));

        foreach ($definitions as $definition) {
            $template = $this->standardTemplate($definition['label']);

            $this->assertSame($definition['model'], $template->model);
            $this->assertContains(
                Submitable::class,
                class_uses_recursive($definition['model']),
                "{$definition['model']} bukan model Submitable",
            );
            $this->assertSame($this->permissionIds[$definition['model']], $template->permission_id);
            $this->assertFalse($template->is_letter_head);
            $this->assertSame('id', $template->default_language);
        }
    }

    #[Test]
    public function fills_font_and_page_number_defaults_when_null(): void {
        $this->seedStandard();

        foreach (StandardPrintTemplateSeeder::definitions() as $definition) {
            $template = $this->standardTemplate($definition['label']);

            $this->assertSame('Arial', $template->font_family, $definition['label']);
            $this->assertSame('bottom_right', $template->page_number, $definition['label']);
            $this->assertSame(':page / :total', $template->page_number_format, $definition['label']);
        }
    }

    #[Test]
    public function does_not_overwrite_font_and_page_number_already_set_and_is_idempotent(): void {
        $this->seedStandard();

        $label    = StandardPrintTemplateSeeder::definitions()[0]['label'];
        $template = $this->standardTemplate($label);
        $template->update([
            'font_family'        => 'Courier New',
            'page_number'        => 'top_left',
            'page_number_format' => 'Hal :page dari :total',
        ]);

        $this->seedStandard();
        $this->seedStandard();

        $template = $this->standardTemplate($label);
        $this->assertSame('Courier New', $template->font_family);
        $this->assertSame('top_left', $template->page_number);
        $this->assertSame('Hal :page dari :total', $template->page_number_format);
        $this->assertSame(1, PrintTemplate::where('name', StandardPrintTemplateSeeder::nameFor($label))->count());
    }

    #[Test]
    public function covers_the_sixteen_expected_models(): void {
        $expected = [
            'App\Models\Asset\Asset',
            'App\Models\Asset\AssetMovement',
            'App\Models\Asset\AssetService',
            'App\Models\Asset\AssetValueAdjustment',
            'App\Models\CRM\Quotation',
            'App\Models\Finances\PaymentEntry',
            'App\Models\Finances\PurchaseInvoice',
            'App\Models\Finances\SalesInvoice',
            'App\Models\Inventory\DeliveryNote',
            'App\Models\Inventory\StockEntry',
            'App\Models\Purchase\PurchaseOrder',
            'App\Models\Purchase\PurchaseReceipt',
            'App\Models\Purchase\PurchaseRequest',
            'App\Models\Sales\InternalOrder',
            'App\Models\Sales\SalesOrder',
            'App\Models\Service\WorkOrder',
        ];

        $actual = array_column(StandardPrintTemplateSeeder::definitions(), 'model');
        sort($expected);
        sort($actual);

        $this->assertSame($expected, $actual);
    }

    #[Test]
    public function is_idempotent(): void {
        $this->seedStandard();
        $first = PrintTemplate::where('name', 'like', 'Standar - %')->orderBy('name')->get(['id', 'name', 'html', 'css', 'used_relations'])->toArray();

        $this->seedStandard();
        $second = PrintTemplate::where('name', 'like', 'Standar - %')->orderBy('name')->get(['id', 'name', 'html', 'css', 'used_relations'])->toArray();

        $this->assertCount(16, $second);
        $this->assertSame($first, $second);
        $this->assertSame(16, PrintTemplate::withTrashed()->where('name', 'like', 'Standar - %')->count());
    }

    /**
     * @return array<string, list<string>>
     */
    private function signatureCaptionsByLabel(): array {
        return [
            'Purchase Order'   => ['Requested by', 'Approved by', 'Accepted / Agreed by'],
            'Purchase Receipt' => ['Received by', 'Acknowledge by'],
            'Delivery Note'    => ['Prepared by', 'Approved by', 'Received by'],
            'Asset Service'    => ['Requested by', 'Approved by'],
            'Sales Invoice'    => ['Dibuat Oleh', 'Disetujui Oleh'],
            'Purchase Invoice' => ['Dibuat Oleh', 'Disetujui Oleh'],
        ];
    }

    #[Test]
    public function every_template_has_both_signature_slots(): void {
        $this->seedStandard();

        $customCaptions = $this->signatureCaptionsByLabel();

        foreach (StandardPrintTemplateSeeder::definitions() as $definition) {
            $label = $definition['label'];
            $html  = $this->standardTemplate($label)->html;

            $this->assertStringContainsString('{{{approvalSignature role="creator" showName=true}}}', $html, $label);
            $this->assertStringContainsString('{{{approvalSignature role="approver" showName=true showDate=true}}}', $html, $label);
            $this->assertSame(2, substr_count($html, '{{{approvalSignature'), $label);

            foreach ($customCaptions[$label] ?? ['Dibuat oleh', 'Disetujui oleh'] as $caption) {
                $this->assertStringContainsString($caption, $html, $label);
            }
        }
    }

    #[Test]
    public function creator_slot_never_asks_for_a_date(): void {
        $this->seedStandard();

        foreach (PrintTemplate::where('name', 'like', 'Standar - %')->get() as $template) {
            preg_match_all('/\{\{\{approvalSignature role="creator"[^}]*\}\}\}/', $template->html, $matches);

            $this->assertCount(1, $matches[0], $template->name);
            $this->assertStringNotContainsString('showDate', $matches[0][0], $template->name);
        }
    }

    #[Test]
    public function none_of_the_new_templates_becomes_default_and_handmade_ones_are_untouched(): void {
        $handmade = $this->makeHandmadeDefaults();
        $before   = collect($handmade)->map(fn (PrintTemplate $t) => $t->fresh()->only(['name', 'html', 'css', 'template', 'is_default', 'updated_at']))->all();

        $this->seedStandard();

        foreach (StandardPrintTemplateSeeder::definitions() as $definition) {
            $this->assertFalse($this->standardTemplate($definition['label'])->is_default, $definition['label']);
        }

        $this->assertSame(0, PrintTemplate::where('name', 'like', 'Standar - %')->where('is_default', true)->count());

        foreach ($handmade as $model => $template) {
            $this->assertEquals($before[$model], $template->fresh()->only(['name', 'html', 'css', 'template', 'is_default', 'updated_at']), $template->name);
            $this->assertTrue($template->fresh()->is_default, $template->name);
        }

        $this->assertSame(16, PrintTemplate::where('name', 'like', 'Default - %')->count());
    }

    #[Test]
    public function uses_the_default_letter_head_without_rewriting_it(): void {
        $letterHead = PrintTemplate::create([
            'name'           => 'Kop Surat Default',
            'is_letter_head' => true,
            'is_default'     => true,
            'html'           => '<body>kop</body>',
        ]);

        $this->seedStandard();

        foreach (PrintTemplate::where('name', 'like', 'Standar - %')->get() as $template) {
            $this->assertSame($letterHead->id, $template->letter_head_id, $template->name);
        }

        $this->assertSame('<body>kop</body>', $letterHead->fresh()->html);
        $this->assertSame(1, PrintTemplate::where('is_letter_head', true)->count());
    }

    #[Test]
    public function document_bodies_differ_per_kind(): void {
        $this->seedStandard();

        $bodies = PrintTemplate::where('name', 'like', 'Standar - %')->pluck('html', 'name');

        $this->assertCount(16, $bodies->unique(), 'Ada template dengan markup yang sama persis.');

        $invoice = $this->standardTemplate('Sales Invoice')->html;
        $this->assertStringContainsString('company.bank_account_number', $invoice);
        $this->assertStringContainsString('doc.items', $invoice);
        $this->assertStringContainsString('this.price', $invoice);
        $this->assertStringContainsString('Total Harga', $invoice);
        $this->assertStringContainsString('doc.dpp_amount', $invoice);
        $this->assertStringNotContainsString('this.dpp_amount', $invoice);
        $this->assertStringContainsString('{{this.price}}', $invoice);
        $this->assertStringContainsString('{{this.basic_amount}}', $invoice);
        $this->assertStringContainsString('{{doc.amount}}', $invoice);
        $this->assertStringNotContainsString('formatCurrency this.price', $invoice);
        $this->assertStringContainsString('>Kuantitas</th>', $invoice);
        $this->assertStringContainsString('>Harga Satuan</th>', $invoice);
        $this->assertStringContainsString('>Total Harga</th>', $invoice);
        $this->assertStringNotContainsString('<th>Discount</th>', $invoice);
        $this->assertStringNotContainsString('<th>Pajak</th>', $invoice);
        $this->assertStringContainsString('doc.outstanding_amount', $invoice);

        // Surat jalan: barang dan kuantitas tanpa harga atau total.
        $delivery = $this->standardTemplate('Delivery Note')->html;
        $this->assertStringContainsString('this.quantity', $delivery);
        $this->assertStringNotContainsString('price', $delivery);
        $this->assertStringNotContainsString('doc.amount', $delivery);

        $stock = $this->standardTemplate('Stock Entry')->html;
        $this->assertStringContainsString('this.source_warehouse.name', $stock);
        $this->assertStringContainsString('this.target_warehouse.name', $stock);

        $payment = $this->standardTemplate('Payment Entry')->html;
        $this->assertStringContainsString('doc.paid_amount', $payment);
        $this->assertStringContainsString('doc.payment_method.name', $payment);
        $this->assertStringNotContainsString('doc.items', $payment);

        $request = $this->standardTemplate('Purchase Request')->html;
        $this->assertStringContainsString('this.description', $request);
        $this->assertStringNotContainsString('this.rate', $request);

        $movement = $this->standardTemplate('Asset Movement')->html;
        $this->assertStringContainsString('this.source_location.location_name', $movement);
        $this->assertStringContainsString('this.target_location.location_name', $movement);

        $work = $this->standardTemplate('Work Order')->html;
        $this->assertStringContainsString('doc.external_note', $work);
        $this->assertStringContainsString('doc.item_service', $work);
    }

    #[Test]
    public function html_is_wrapped_in_a_single_document_element(): void {
        $this->seedStandard();

        foreach (PrintTemplate::where('name', 'like', 'Standar - %')->get() as $template) {
            $this->assertStringStartsWith('<body>', $template->html, $template->name);
            $this->assertSame(1, substr_count($template->html, '</body>'), $template->name);
            // Renderer mengganti kata itu secara literal; tidak boleh muncul
            // di tempat lain selain pembungkus.
            $this->assertSame(2, preg_match_all('/(?<!t)body/', $template->html), $template->name);
        }
    }

    #[Test]
    public function every_template_compiles_and_renders_both_slots(): void {
        $this->seedStandard();

        $service = app(PrintTemplateRenderService::class);
        $compile = new \ReflectionMethod($service, 'compileHandlebars');

        $customCaptionsByName = collect($this->signatureCaptionsByLabel())
            ->mapWithKeys(fn (array $captions, string $label) => [StandardPrintTemplateSeeder::nameFor($label) => $captions])
            ->all();

        foreach (PrintTemplate::where('name', 'like', 'Standar - %')->get() as $template) {
            $html = $compile->invoke($service, str_replace('body', 'main', $template->html), [
                'lang'     => 'id',
                'modelDoc' => $template->model,
                'columns'  => [],
                'company'  => [],
                'docInfo'  => [],
                'document' => null,
                'doc'      => [],
            ]);

            // compileHandlebars() mengembalikan string kosong, tanpa
            // exception, bila kompilasi gagal.
            $this->assertNotSame('', $html, "{$template->name} gagal dikompilasi");
            foreach ($customCaptionsByName[$template->name] ?? ['Dibuat oleh', 'Disetujui oleh'] as $caption) {
                $this->assertStringContainsString($caption, $html, $template->name);
            }
            $this->assertStringNotContainsString('{{', $html, $template->name);
        }
    }

    /**
     * Field yang salah tidak menimbulkan error: renderer membuang kunci yang
     * tidak ada di daftar kolom, sehingga hasil cetaknya kosong tanpa
     * peringatan. Test ini memeriksa setiap jalur di markup terhadap daftar
     * kolom yang sama dengan yang dipakai renderer.
     */
    #[Test]
    public function every_referenced_field_exists_and_its_relation_is_loaded(): void {
        $this->seedStandard();

        $errors = [];

        $checker = new PrintTemplateFieldChecker;

        foreach (PrintTemplate::where('name', 'like', 'Standar - %')->get() as $template) {
            foreach ($checker->errors($template->model, $template->used_relations, $template->html) as $error) {
                $errors[] = "{$template->name}: {$error}";
            }
        }

        $this->assertSame([], $errors, "Field/relasi tidak valid:\n" . implode("\n", $errors));
    }

    #[Test]
    public function used_relations_are_exactly_what_the_markup_needs(): void {
        $this->seedStandard();

        $errors = [];

        foreach (PrintTemplate::where('name', 'like', 'Standar - %')->get() as $template) {
            $tracker  = app(RelationTrackerService::class);
            $checker  = new PrintTemplateFieldChecker;
            $declared = collect($template->used_relations)->map(fn ($path) => $checker->camelPath($path))->sort()->values()->all();
            $needed   = $checker->neededRelations($template->model, $template->used_relations, $template->html);

            $unresolved = array_diff($declared, $tracker->validateRelations($template->model, $declared));
            if ($unresolved !== []) {
                $errors[] = "{$template->name}: relasi tidak ada di model: " . implode(', ', $unresolved);
            }

            $required = $template->model === SalesInvoice::class
                ? [...$needed, 'currency']
                : $needed;
            sort($required);
            if ($declared !== $required) {
                $errors[] = "{$template->name}: dideklarasikan [" . implode(', ', $declared) . '] tetapi dipakai [' . implode(', ', $required) . ']';
            }
        }

        $this->assertSame([], $errors, implode("\n", $errors));
    }

    #[Test]
    public function titles_are_literal_text_not_translation_keys(): void {
        $this->seedStandard();

        foreach (PrintTemplate::where('name', 'like', 'Standar - %')->get() as $template) {
            // `__()` di sisi server tidak meresolusi kunci bersarang seperti
            // `sales.salesOrder.title`; PDF render server akan mencetak
            // kunci mentahnya.
            $this->assertStringNotContainsString('{{trans', $template->html, $template->name);

            // Surat penawaran tidak punya judul dokumen; kepalanya kota,
            // tanggal, dan tujuan surat.
            if ($template->model !== Quotation::class) {
                $this->assertMatchesRegularExpression('/<div class="doc-title(?:\s+[^"]*)?">[^{<]+<\/div>/', $template->html, $template->name);
            }
        }
    }

    #[Test]
    public function redesigned_pataya_templates_include_item_details_and_official_layout_sections(): void {
        $this->seedStandard();

        $redesignedLabels = [
            'Sales Order',
            'Internal Order',
            'Purchase Invoice',
            'Delivery Note',
            'Purchase Order',
            'Purchase Receipt',
            'Asset Service',
        ];

        foreach ($redesignedLabels as $label) {
            $html = $this->standardTemplate($label)->html;

            $this->assertStringContainsString('{{companyDetail "company_name"}}', $html, $label);
            $this->assertStringContainsString('<th>Part No</th>', $html, $label);
            $this->assertStringContainsString('{{this.item.item_code}}', $html, $label);
            $this->assertStringContainsString('formatDate', $html, $label);
            $this->assertStringContainsString('formatNumber this.quantity 0', $html, $label);
        }

        $invoice = $this->standardTemplate('Sales Invoice')->html;
        $this->assertStringContainsString('<th>Item</th>', $invoice);
        $this->assertStringContainsString('{{relation this.item}}', $invoice);
        $this->assertStringNotContainsString('<th>Part No</th>', $invoice);
        $this->assertStringNotContainsString('{{this.item.item_code}}', $invoice);
        $this->assertStringContainsString('table-layout: fixed;', $this->standardTemplate('Sales Invoice')->css);
        $this->assertStringContainsString('max-height: 58px !important;', $this->standardTemplate('Sales Invoice')->css);

        foreach (['Sales Order', 'Sales Invoice', 'Delivery Note'] as $customerDoc) {
            $html = $this->standardTemplate($customerDoc)->html;
            $this->assertStringContainsString('doc.customer_branch.billing_street', $html, $customerDoc);
            $this->assertStringContainsString('doc.customer_branch.shipping_street', $html, $customerDoc);
            $this->assertStringContainsString('{{doc.customer.vat}}', $html, $customerDoc);
        }

        $assetServiceHtml = $this->standardTemplate('Asset Service')->html;
        $this->assertStringContainsString('<div class="doc-title doc-title-right">Work Order</div>', $assetServiceHtml);
        $this->assertStringContainsString('{{doc.asset.code}}', $assetServiceHtml);
        $this->assertStringContainsString('{{doc.asset.asset_name}}', $assetServiceHtml);
    }

    #[Test]
    public function every_template_has_grapesjs_project_json_for_editor(): void {
        $this->seedStandard();

        foreach (PrintTemplate::where('name', 'like', 'Standar - %')->get() as $template) {
            $project = $template->template;

            $this->assertIsArray($project, "{$template->name} tidak memiliki project JSON untuk editor");
            $components = $project['pages'][0]['frames'][0]['component']['components'] ?? null;
            $this->assertIsArray($components, "{$template->name} tidak memiliki komponen halaman utama");
            $this->assertNotEmpty($components, "{$template->name} memiliki komponen kosong di editor");
            $this->assertNotEmpty($project['styles'] ?? [], "{$template->name} tidak memiliki definisi styles di editor");
        }
    }
}
