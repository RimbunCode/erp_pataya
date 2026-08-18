<?php

namespace Tests\Feature\Core;

use App\Models\Core\EmailTemplate;
use App\Models\Model as AppModel;
use App\Services\Core\EmailTemplate\EmailTemplateRenderService;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Stub relasi: Customer punya Address, dipakai untuk menguji render
 * token nested (`$doc->customer->address->city`) tanpa bergantung
 * skema model produksi (SalesOrder dkk).
 */
class RenderTestAddress extends AppModel {
    use HasUlids;

    protected $table   = 'render_test_addresses';
    protected $guarded = ['id'];
}

class RenderTestCustomer extends AppModel {
    use HasUlids;

    protected $table   = 'render_test_customers';
    protected $guarded = ['id'];

    public function address() {
        return $this->belongsTo(RenderTestAddress::class, 'address_id');
    }
}

class RenderTestDocument extends AppModel {
    use HasUlids;

    protected $table            = 'render_test_documents';
    protected $guarded          = ['id'];
    public string $translateKey = 'test.document';

    public function customer() {
        return $this->belongsTo(RenderTestCustomer::class, 'customer_id');
    }
}

class EmailTemplateRenderServiceTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // Global scope HasExampleData butuh kolom is_example (ditambah via initPermissions di prod).
        if (Schema::hasTable('email_templates') && ! Schema::hasColumn('email_templates', 'is_example')) {
            Schema::table('email_templates', fn ($t) => $t->boolean('is_example')->default(false));
        }

        Schema::create('render_test_addresses', function ($t) {
            $t->ulid('id')->primary();
            $t->string('city')->nullable();
            $t->timestamps();
        });

        Schema::create('render_test_customers', function ($t) {
            $t->ulid('id')->primary();
            $t->string('name')->nullable();
            $t->char('address_id', 26)->nullable();
            $t->timestamps();
        });

        Schema::create('render_test_documents', function ($t) {
            $t->ulid('id')->primary();
            $t->string('number')->nullable();
            $t->char('customer_id', 26)->nullable();
            $t->timestamps();
        });
    }

    private function makeDoc(): RenderTestDocument {
        $address  = RenderTestAddress::create(['city' => 'Jakarta']);
        $customer = RenderTestCustomer::create(['name' => 'PT Contoh', 'address_id' => $address->id]);

        return RenderTestDocument::create(['number' => 'SO-001', 'customer_id' => $customer->id]);
    }

    public function test_renders_direct_attribute_token(): void {
        $template = EmailTemplate::factory()->make([
            'model'     => RenderTestDocument::class,
            'subject'   => 'Order {{ $doc->number }}',
            'body_html' => '<p>Nomor: {{ $doc->number }}</p>',
        ]);

        $result = app(EmailTemplateRenderService::class)->render($template, $this->makeDoc());

        $this->assertEquals('Order SO-001', $result['subject']);
        $this->assertEquals('<p>Nomor: SO-001</p>', $result['body']);
    }

    public function test_renders_nested_relation_token(): void {
        $template = EmailTemplate::factory()->make([
            'model'     => RenderTestDocument::class,
            'subject'   => 'Halo {{ $doc->customer->name }}',
            'body_html' => '<p>Kota: {{ $doc->customer->address->city }}</p>',
        ]);

        $result = app(EmailTemplateRenderService::class)->render($template, $this->makeDoc());

        $this->assertEquals('Halo PT Contoh', $result['subject']);
        $this->assertEquals('<p>Kota: Jakarta</p>', $result['body']);
    }

    public function test_eager_loads_relations_used_in_template_to_avoid_n_plus_one(): void {
        $template = EmailTemplate::factory()->make([
            'model'     => RenderTestDocument::class,
            'subject'   => 'Halo {{ $doc->customer->name }}',
            'body_html' => '<p>Kota: {{ $doc->customer->address->city }}</p>',
        ]);

        $doc = $this->makeDoc();

        $queryCount = 0;
        DB::listen(function () use (&$queryCount) {
            $queryCount++;
        });

        app(EmailTemplateRenderService::class)->render($template, $doc);

        // loadMissing(customer, customer.address) = 2 query data + 1 query
        // resolveCompanyDetails. Nested access token TIDAK boleh menambah
        // query data lagi (itu tanda N+1). Anggaran (5) menoleransi overhead
        // schema-introspection SQLite (pragma_table_xinfo/sqlite_master saat
        // model Preference pertama diakses) tanpa melonggarkan deteksi N+1
        // sungguhan.
        $this->assertLessThanOrEqual(5, $queryCount);
    }

    public function test_invalid_relation_token_renders_as_blank_without_throwing(): void {
        $template = EmailTemplate::factory()->make([
            'model'     => RenderTestDocument::class,
            'subject'   => 'Order {{ $doc->number }}',
            'body_html' => '<p>{{ $doc->customer->nonExistentRelation->value }}</p><p>Nomor: {{ $doc->number }}</p>',
        ]);

        $result = app(EmailTemplateRenderService::class)->render($template, $this->makeDoc());

        $this->assertEquals('Order SO-001', $result['subject']);
        $this->assertStringContainsString('Nomor: SO-001', $result['body']);
        $this->assertStringNotContainsString('nonExistentRelation', $result['body']);
    }

    public function test_php_directive_in_body_is_not_executed(): void {
        $template = EmailTemplate::factory()->make([
            'model'     => RenderTestDocument::class,
            'subject'   => 'Order {{ $doc->number }}',
            'body_html' => '<p>{{ $doc->number }}</p>@php(exit("PWNED"))<p>{!! "no escape" !!}</p><?php echo "raw"; ?>',
        ]);

        $result = app(EmailTemplateRenderService::class)->render($template, $this->makeDoc());

        // Token whitelist tetap tersubstitusi normal...
        $this->assertStringContainsString('SO-001', $result['body']);
        // ...tapi directive Blade / tag PHP dibiarkan sebagai teks literal, TIDAK dieksekusi.
        $this->assertStringContainsString('@php(exit("PWNED"))', $result['body']);
        $this->assertStringContainsString('<?php echo "raw"; ?>', $result['body']);
    }

    public function test_function_call_expression_is_not_substituted(): void {
        $template = EmailTemplate::factory()->make([
            'model'     => RenderTestDocument::class,
            'subject'   => 'Subject',
            'body_html' => '<p>{{ $doc->number }} {{ phpinfo() }} {{ $doc->number() }}</p>',
        ]);

        $result = app(EmailTemplateRenderService::class)->render($template, $this->makeDoc());

        $this->assertStringContainsString('SO-001', $result['body']);
        // Token dengan pemanggilan fungsi/method tidak match pola whitelist → dibiarkan literal.
        $this->assertStringContainsString('{{ phpinfo() }}', $result['body']);
        $this->assertStringContainsString('{{ $doc->number() }}', $result['body']);
    }

    public function test_rendered_value_is_html_escaped(): void {
        $address  = RenderTestAddress::create(['city' => '<script>alert(1)</script>']);
        $customer = RenderTestCustomer::create(['name' => 'PT Contoh', 'address_id' => $address->id]);
        $doc      = RenderTestDocument::create(['number' => 'SO-XSS', 'customer_id' => $customer->id]);

        $template = EmailTemplate::factory()->make([
            'model'     => RenderTestDocument::class,
            'subject'   => 'Subject',
            'body_html' => '<p>{{ $doc->customer->address->city }}</p>',
        ]);

        $result = app(EmailTemplateRenderService::class)->render($template, $doc);

        $this->assertStringNotContainsString('<script>', $result['body']);
        $this->assertStringContainsString('&lt;script&gt;', $result['body']);
    }
}
