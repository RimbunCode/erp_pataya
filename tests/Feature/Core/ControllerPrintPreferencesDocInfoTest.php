<?php

namespace Tests\Feature\Core;

use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\PrintTemplate;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ControllerPrintPreferencesDocInfoTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
        ]);

        if (! Schema::hasTable('preferences')) {
            Schema::create('preferences', function (Blueprint $table): void {
                $table->string('key')->primary();
                $table->text('value');
                $table->boolean('is_example')->default(false);
                $table->timestamps();
            });
        }

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
                $table->string('referenceable_type')->nullable();
                $table->char('referenceable_id', 26)->nullable();
                $table->char('customer_id', 26)->nullable();
                $table->string('customer_name')->nullable();
                $table->char('customer_branch_id', 26)->nullable();
                $table->string('customer_branch_name')->nullable();
                $table->char('reference_so_id', 26)->nullable();
                $table->boolean('is_rent')->default(false);
                $table->timestamp('date')->nullable();
                $table->timestamp('start_date')->nullable();
                $table->timestamp('end_date')->nullable();
                $table->text('external_note')->nullable();
                $table->string('currency_code')->nullable();
                $table->string('base_currency_code')->nullable();
                $table->double('exchange_rate')->nullable();
                $table->double('discount_amount')->default(0);
                $table->double('discount_rate')->default(0);
                $table->string('discount_on')->nullable();
                $table->double('amount')->default(0);
                $table->boolean('is_example')->default(false);
                $table->string('code')->nullable();
                $table->json('status')->nullable();
                $table->char('created_by_id', 26)->nullable();
                $table->timestamp('submitted_at')->nullable();
                $table->timestamp('canceled_at')->nullable();
                $table->integer('revision_number')->default(0);
                $table->json('additional_data')->nullable();
                $table->string('submitted_format')->nullable();
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

        if (! Schema::hasTable('roles')) {
            Schema::create('roles', function (Blueprint $table): void {
                $table->char('id', 26)->primary();
                $table->string('name');
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (! Schema::hasTable('user_role')) {
            Schema::create('user_role', function (Blueprint $table): void {
                $table->char('user_id', 26);
                $table->char('role_id', 26);
                $table->timestamps();
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

        if (! Schema::hasTable('formating_series')) {
            Schema::create('formating_series', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->string('name');
                $table->string('model')->unique();
                $table->json('logs')->nullable();
                $table->string('format');
                $table->boolean('is_example')->default(false);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('sales_order_items')) {
            Schema::create('sales_order_items', function (Blueprint $table): void {
                $table->ulid('id')->primary();
                $table->char('sales_order_id', 26)->nullable();
                $table->string('name')->nullable();
                $table->boolean('is_example')->default(false);
                $table->softDeletes();
                $table->timestamps();
            });
        }
    }

    public function test_print_response_contains_preferences_prop_with_correct_key_value_data(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();
        $salesOrder    = $this->createSalesOrder();

        // Insert preferences
        DB::table('preferences')->insert([
            ['key' => 'company_name', 'value' => '"PT Test Company"', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'phone', 'value' => '"021-12345"', 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'email', 'value' => '"test@company.com"', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->get(route('salesOrders.print', ['salesOrder' => $salesOrder->id, 'printTemplate' => $printTemplate->id]));

        $response->assertOk();
        $response->assertInertia(
            fn (Assert $page) => $page
                ->component('Core/Print')
                ->has('preferences')
                ->where('preferences.company_name', 'PT Test Company')
                ->where('preferences.phone', '021-12345')
                ->where('preferences.email', 'test@company.com'),
        );
    }

    public function test_print_response_contains_doc_info_prop_with_document_name(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();
        $salesOrder    = $this->createSalesOrder(['code' => 'SO-001/2025']);

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->get(route('salesOrders.print', ['salesOrder' => $salesOrder->id, 'printTemplate' => $printTemplate->id]));

        $response->assertOk();
        $response->assertInertia(
            fn (Assert $page) => $page
                ->component('Core/Print')
                ->has('docInfo')
                ->where('docInfo.name', 'SO-001/2025'),
        );
    }

    public function test_print_response_returns_empty_preferences_array_when_fetch_fails(): void {
        $user          = User::factory()->create();
        $printTemplate = $this->createPrintTemplate();
        $salesOrder    = $this->createSalesOrder();

        // Drop the preferences table to simulate a fetch failure
        Schema::dropIfExists('preferences');

        $response = $this->actingAs($user)
            ->withSession(['permissions' => $this->makePermissions()])
            ->get(route('salesOrders.print', ['salesOrder' => $salesOrder->id, 'printTemplate' => $printTemplate->id]));

        $response->assertOk();
        $response->assertInertia(
            fn (Assert $page) => $page
                ->component('Core/Print')
                ->where('preferences', []),
        );
    }

    private function createPrintTemplate(array $overrides = []): PrintTemplate {
        return PrintTemplate::create(array_merge([
            'name'           => 'Test Print Template',
            'name_model'     => 'SalesOrders',
            'model'          => SalesOrder::class,
            'is_default'     => true,
            'orientation'    => 'portrait',
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
    private function makePermissions(): array {
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
                            'print'  => true,
                        ],
                    ],
                ],
            ],
        ];
    }
}
