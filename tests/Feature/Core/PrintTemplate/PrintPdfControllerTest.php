<?php

namespace Tests\Feature\Core\PrintTemplate;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\Fileable;
use App\Models\Core\PrintTemplate;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class PrintPdfControllerTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        if (! Schema::hasTable('print_templates')) {
            Schema::create('print_templates', function (Blueprint $table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->char('permission_id', 26)->nullable();
                $table->boolean('is_letter_head')->default(false);
                $table->char('letter_head_id', 26)->nullable();
                $table->string('name_model')->nullable();
                $table->string('model')->nullable();
                $table->longText('html')->nullable();
                $table->longText('css')->nullable();
                $table->json('template')->nullable();
                $table->json('used_relations')->nullable();
                $table->boolean('is_default')->default(false);
                $table->boolean('is_example')->default(false);
                $table->string('default_language')->nullable();
                $table->string('font_family')->nullable();
                $table->string('paper')->nullable();
                $table->string('page_number')->nullable();
                $table->string('orientation')->default('portrait');
                $table->double('width')->nullable();
                $table->double('height')->nullable();
                $table->double('margin_top')->nullable();
                $table->double('margin_bottom')->nullable();
                $table->double('margin_left')->nullable();
                $table->double('margin_right')->nullable();
                $table->boolean('show_absolute_values')->default(false);
                $table->string('unit')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('sales_orders')) {
            Schema::create('sales_orders', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->string('code')->nullable();
                $table->char('created_by_id', 26)->nullable();
                $table->timestamp('date')->nullable();
                $table->json('status')->nullable();
                $table->boolean('is_example')->default(false);
                $table->softDeletes();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->string('username')->nullable();
                $table->string('email')->unique();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('password')->nullable();
                $table->string('remember_token', 100)->nullable();
                $table->string('status')->default('pending');
                $table->string('image')->nullable();
                $table->char('default_branch_id', 26)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('permissions')) {
            Schema::create('permissions', function (Blueprint $table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->string('model')->nullable();
                $table->string('module')->nullable();
                $table->json('permissions')->nullable();
                $table->boolean('is_submitable')->default(false);
                $table->boolean('allow_only_creator')->default(false);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('files')) {
            Schema::create('files', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->string('name');
                $table->text('path')->nullable();
                $table->string('extension')->nullable();
                $table->string('mime_type');
                $table->boolean('is_public')->default(false);
                $table->boolean('is_draft')->default(false);
                $table->boolean('is_example')->default(false);
                $table->char('created_by_id', 26)->nullable();
                $table->integer('lft')->nullable();
                $table->integer('rgt')->nullable();
                $table->integer('depth')->nullable();
                $table->char('parent_id', 26)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('fileables')) {
            Schema::create('fileables', function (Blueprint $table): void {
                $table->char('file_id', 26);
                $table->ulidMorphs('fileable');
                $table->boolean('is_generated_pdf')->default(false);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        config(['pdf.wkhtmltopdf_binary' => storage_path('app/bin/does-not-exist-binary')]);
    }

    public function test_user_without_print_permission_is_forbidden(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();
        $salesOrder    = $this->createSalesOrder();

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions(canPrint: false)])
            ->postJson(route('salesOrders.print.pdf', ['salesOrder' => $salesOrder->id, 'printTemplate' => $printTemplate->id]), [
                'html' => '<html><body>Test</body></html>',
            ]);

        $response->assertForbidden();
    }

    public function test_user_with_print_permission_receives_pdf_binary(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();
        $salesOrder    = $this->createSalesOrder();

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions(canPrint: true)])
            ->postJson(route('salesOrders.print.pdf', ['salesOrder' => $salesOrder->id, 'printTemplate' => $printTemplate->id]), [
                'html' => '<html><body><h1>Invoice</h1></body></html>',
            ]);

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $response->getContent());
    }

    public function test_manual_download_also_attaches_pdf_to_document(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();
        $salesOrder    = $this->createSalesOrder();

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions(canPrint: true)])
            ->postJson(route('salesOrders.print.pdf', ['salesOrder' => $salesOrder->id, 'printTemplate' => $printTemplate->id]), [
                'html' => '<html><body><h1>Invoice</h1></body></html>',
            ]);

        $response->assertOk();
        $this->assertStringStartsWith('%PDF-', $response->getContent());

        $fileable = Fileable::where('fileable_id', $salesOrder->id)
            ->where('fileable_type', SalesOrder::class)
            ->first();

        $this->assertNotNull($fileable, 'Expected the manual download to also attach a Fileable record');
        $this->assertSame('application/pdf', $fileable->file->mime_type);
        $this->assertTrue($fileable->is_generated_pdf);
    }

    public function test_html_payload_exceeding_size_limit_is_rejected(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();
        $salesOrder    = $this->createSalesOrder();

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions(canPrint: true)])
            ->postJson(route('salesOrders.print.pdf', ['salesOrder' => $salesOrder->id, 'printTemplate' => $printTemplate->id]), [
                'html' => str_repeat('a', 6 * 1024 * 1024),
            ]);

        $response->assertStatus(422);
    }

    private function createPrintTemplate(array $overrides = []): PrintTemplate {
        return PrintTemplate::create(array_merge([
            'name'           => 'Test Print Template',
            'name_model'     => 'SalesOrders',
            'model'          => SalesOrder::class,
            'is_default'     => true,
            'orientation'    => 'portrait',
            'unit'           => 'cm',
            'width'          => 21,
            'height'         => 29.7,
            'used_relations' => ['_none'],
        ], $overrides));
    }

    private function createSalesOrder(array $overrides = []): SalesOrder {
        $id   = (string) Str::ulid();
        $data = array_merge([
            'id'         => $id,
            'code'       => 'SO-TEST-001',
            'date'       => now(),
            'status'     => json_encode(['draft']),
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides);

        DB::table('sales_orders')->insert($data);

        return SalesOrder::withoutGlobalScopes()->find($id);
    }

    /**
     * @return array<string, mixed>
     */
    private function makePermissions(bool $canPrint): array {
        return [
            SalesOrder::class => [
                0 => [
                    [
                        'model'        => SalesOrder::class,
                        'level'        => 0,
                        'only_creator' => false,
                        'permissions'  => [
                            'select' => true,
                            'read'   => true,
                            'write'  => true,
                            'create' => true,
                            'delete' => true,
                            'print'  => $canPrint,
                        ],
                    ],
                ],
            ],
        ];
    }
}
