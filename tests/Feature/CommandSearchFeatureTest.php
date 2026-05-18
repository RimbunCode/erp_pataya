<?php

namespace Tests\Feature;

use App\Models\Model;
use App\Models\User\Permission as PermissionModel;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CommandSearchFeatureTest extends TestCase {
    private string $sqliteDatabasePath;

    protected function setUp(): void {
        parent::setUp();

        $this->sqliteDatabasePath = database_path('command-search-test.sqlite');
        if (file_exists($this->sqliteDatabasePath)) {
            unlink($this->sqliteDatabasePath);
        }
        touch($this->sqliteDatabasePath);

        config()->set('database.connections.sqlite.database', $this->sqliteDatabasePath);
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        config()->set('have_transactions.enabled', false);
        config()->set('command_search.enabled', true);
        config()->set('command_search.exclude_models', []);
        config()->set('command_search.exclude_record_models', []);
        config()->set('command_search.model_priorities', []);
        config()->set('command_search.record_chunk_size', 100);
        config()->set('command_search.record_target_relations', [
            CommandSearchPaymentSchedule::class => 'payment_scheduleable',
            CommandSearchApprovalStep::class    => 'approvalInstance.document',
            CommandSearchStockLedger::class     => 'referenceable',
        ]);
        config()->set('command_search.route_overrides', [
            CommandSearchPurchaseRequest::class => 'purchaseRequests.show',
        ]);

        Schema::dropIfExists('commands');
        Schema::dropIfExists('command_recents');
        Schema::dropIfExists('formating_series');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('users');
        Schema::dropIfExists('command_search_users');
        Schema::dropIfExists('command_search_purchase_requests');
        Schema::dropIfExists('command_search_payment_schedules');
        Schema::dropIfExists('command_search_approval_instances');
        Schema::dropIfExists('command_search_approval_steps');
        Schema::dropIfExists('command_search_stock_ledgers');
        Schema::dropIfExists('command_search_sales_orders');
        Schema::dropIfExists('command_search_parents');
        Schema::dropIfExists('command_search_children');
        Schema::dropIfExists('command_search_items');
        Schema::dropIfExists('command_search_item_alternatives');

        Schema::create('users', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password')->nullable();
            $table->string('status')->default('pending');
            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('module');
            $table->string('name');
            $table->text('model');
            $table->string('route')->nullable();
            $table->text('permissions')->nullable();
            $table->boolean('is_submitable')->default(false);
            $table->boolean('allow_only_creator')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('commands', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('signature')->unique();
            $table->string('type');
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->text('search_text')->nullable();
            $table->string('route_name')->nullable();
            $table->text('route_params')->nullable();
            $table->string('target_model_type')->nullable();
            $table->string('target_model_id')->nullable();
            $table->string('source_model_type')->nullable();
            $table->string('source_model_id')->nullable();
            $table->string('owner_id')->nullable();
            $table->text('meta')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('command_recents', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('user_id');
            $table->string('recent_key');
            $table->string('signature')->nullable();
            $table->string('type')->nullable();
            $table->string('title');
            $table->string('subtitle')->nullable();
            $table->string('route_name')->nullable();
            $table->text('route_params')->nullable();
            $table->string('target_model_type')->nullable();
            $table->string('target_model_id')->nullable();
            $table->string('source_model_type')->nullable();
            $table->string('source_model_id')->nullable();
            $table->text('payload')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['user_id', 'recent_key']);
        });

        Schema::create('formating_series', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('model')->unique();
            $table->text('logs')->nullable();
            $table->string('format');
            $table->timestamps();
        });

        Schema::create('command_search_users', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('command_search_purchase_requests', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('code');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('command_search_payment_schedules', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('payment_scheduleable_type');
            $table->string('payment_scheduleable_id');
            $table->string('reference_to')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('command_search_approval_instances', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('document_type');
            $table->string('document_id');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('command_search_approval_steps', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('approval_instance_id');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('command_search_stock_ledgers', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('referenceable_type');
            $table->string('referenceable_id');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('command_search_sales_orders', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('code')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('command_search_parents', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('code');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('command_search_children', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('parent_id');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('command_search_items', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('code');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('command_search_item_alternatives', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('code');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    protected function tearDown(): void {
        parent::tearDown();

        DB::purge('sqlite');
        if (isset($this->sqliteDatabasePath) && file_exists($this->sqliteDatabasePath)) {
            unlink($this->sqliteDatabasePath);
        }
    }

    public function test_rebuild_command_indexes_navigation_and_records_without_duplicates(): void {
        $this->seedCorePermissions();
        CommandSearchPurchaseRequest::create(['code' => 'PR-001']);
        CommandSearchPurchaseRequest::create(['code' => 'PR-002']);

        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $rows = DB::table('commands')->whereNull('deleted_at')->get();
        $this->assertGreaterThanOrEqual(4, $rows->count());
        $this->assertSame($rows->count(), $rows->pluck('signature')->unique()->count());
    }

    public function test_search_api_returns_navigation_and_document_match(): void {
        $this->seedCorePermissions();
        $purchaseRequest = CommandSearchPurchaseRequest::create(['code' => 'PR-001']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchUserModel::class,
            CommandSearchPurchaseRequest::class,
        ]);

        $authUser = $this->makeAuthUser();

        $usersResponse = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'users']));

        $usersResponse->assertOk();
        $usersResponse->assertJsonPath('data.navigation.0.route_name', 'users.index');

        $documentResponse = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'PR-001']));

        $documentResponse->assertOk();
        $documentResponse->assertJsonPath('data.documents.0.route_name', 'purchaseRequests.show');
        $documentResponse->assertJsonPath('data.documents.0.route_params.purchaseRequest', $purchaseRequest->id);
        $documentResponse->assertJsonFragment(['route_name' => 'purchaseRequests.index']);
    }

    public function test_search_api_returns_navigation_for_doctype_and_typo(): void {
        $this->seedCorePermissions();
        $this->insertPermission(
            module: 'Sales',
            name: 'Sales Orders',
            model: CommandSearchSalesOrder::class,
            route: 'salesOrders',
        );

        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchUserModel::class,
            CommandSearchPurchaseRequest::class,
            CommandSearchSalesOrder::class,
        ]);

        $doctypeResponse = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'sales order']));

        $doctypeResponse->assertOk();
        $doctypeResponse->assertJsonPath('data.navigation.0.route_name', 'salesOrders.index');

        $typoResponse = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'sales oder']));

        $typoResponse->assertOk();
        $typoResponse->assertJsonPath('data.navigation.0.route_name', 'salesOrders.index');
    }

    public function test_search_api_filters_document_without_permission(): void {
        $this->seedCorePermissions();
        CommandSearchPurchaseRequest::create(['code' => 'PR-001']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchUserModel::class,
        ]);

        $response = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'PR-001']));

        $response->assertOk();
        $response->assertJsonCount(0, 'data.documents');
        $response->assertJsonMissing(['route_name' => 'purchaseRequests.index']);
    }

    public function test_scoped_query_items_code_prioritizes_items_document_and_exposes_intent_meta(): void {
        $this->seedCorePermissions();
        $this->insertPermission(
            module: 'Inventory',
            name: 'Items',
            model: CommandSearchItem::class,
            route: 'items',
            isSubmitable: true,
        );
        $this->insertFormatingSeries(
            model: CommandSearchItem::class,
            name: 'Item',
            format: 'ITM-@[iiii]',
        );

        $purchaseRequest = CommandSearchPurchaseRequest::create(['code' => 'GDS-0706']);
        $item            = CommandSearchItem::create(['code' => 'GDS-0706']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchUserModel::class,
            CommandSearchPurchaseRequest::class,
            CommandSearchItem::class,
        ]);

        $response = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'items gds-0706']));

        $response->assertOk();
        $response->assertJsonPath('data.meta.intent.is_scoped', true);
        $response->assertJsonPath('data.meta.intent.prioritize_documents', true);
        $response->assertJsonPath('data.meta.intent.doctype_model', CommandSearchItem::class);
        $response->assertJsonPath('data.meta.intent.is_singular_doctype', true);
        $response->assertJsonPath('data.documents.0.route_name', 'items.show');
        $response->assertJsonPath('data.documents.0.route_params.item', $item->id);
        $response->assertJsonPath('data.documents.1.route_name', 'purchaseRequests.show');
        $response->assertJsonPath('data.documents.1.route_params.purchaseRequest', $purchaseRequest->id);

        $reversedResponse = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'gds-0706 items']));

        $reversedResponse->assertOk();
        $reversedResponse->assertJsonPath('data.meta.intent.is_scoped', true);
        $reversedResponse->assertJsonPath('data.documents.0.route_name', 'items.show');
        $reversedResponse->assertJsonPath('data.documents.0.route_params.item', $item->id);

        $doctypeOnlyResponse = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'items']));

        $doctypeOnlyResponse->assertOk();
        $doctypeOnlyResponse->assertJsonPath('data.navigation.0.route_name', 'items.index');
    }

    public function test_singular_scoped_query_items_sets_singular_intent_and_prioritizes_item_document(): void {
        $this->seedCorePermissions();
        $this->insertPermission(
            module: 'Inventory',
            name: 'Items',
            model: CommandSearchItem::class,
            route: 'items',
            isSubmitable: true,
        );
        $this->insertFormatingSeries(
            model: CommandSearchItem::class,
            name: 'Item',
            format: 'ITM-@[iiii]',
        );

        $purchaseRequest = CommandSearchPurchaseRequest::create(['code' => 'GDS-0706']);
        $item            = CommandSearchItem::create(['code' => 'GDS-0706']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchPurchaseRequest::class,
            CommandSearchItem::class,
        ]);

        $response = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'item gds-0706']));

        $response->assertOk();
        $response->assertJsonPath('data.meta.intent.is_scoped', true);
        $response->assertJsonPath('data.meta.intent.is_singular_doctype', true);
        $response->assertJsonPath('data.documents.0.route_name', 'items.show');
        $response->assertJsonPath('data.documents.0.route_params.item', $item->id);
        $response->assertJsonPath('data.documents.1.route_name', 'purchaseRequests.show');
        $response->assertJsonPath('data.documents.1.route_params.purchaseRequest', $purchaseRequest->id);

        $reversed = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'gds-0706 item']));

        $reversed->assertOk();
        $reversed->assertJsonPath('data.meta.intent.is_scoped', true);
        $reversed->assertJsonPath('data.meta.intent.is_singular_doctype', true);
        $reversed->assertJsonPath('data.documents.0.route_name', 'items.show');
    }

    public function test_code_query_infers_submitable_doctype_and_returns_document_and_navigation(): void {
        $this->seedCorePermissions();
        $purchaseRequest = CommandSearchPurchaseRequest::create(['code' => 'PR-001']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchPurchaseRequest::class,
        ]);

        $response = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'PR-001']));

        $response->assertOk();
        $response->assertJsonPath('data.meta.intent.prioritize_documents', true);
        $response->assertJsonPath('data.meta.intent.doctype_model', CommandSearchPurchaseRequest::class);
        $response->assertJsonPath('data.documents.0.route_name', 'purchaseRequests.show');
        $response->assertJsonPath('data.documents.0.route_params.purchaseRequest', $purchaseRequest->id);
        $response->assertJsonFragment(['route_name' => 'purchaseRequests.index']);
    }

    public function test_configured_model_priority_can_prioritize_item_over_item_alternative(): void {
        $this->insertPermission(
            module: 'Inventory',
            name: 'Items',
            model: CommandSearchItem::class,
            route: 'items',
        );
        $this->insertPermission(
            module: 'Inventory',
            name: 'Item Alternatives',
            model: CommandSearchItemAlternative::class,
            route: 'itemAlternatives',
        );

        $item            = CommandSearchItem::create(['code' => 'ITM-1001']);
        $itemAlternative = CommandSearchItemAlternative::create(['code' => 'ITM-1001']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchItem::class,
            CommandSearchItemAlternative::class,
        ]);

        config()->set('command_search.model_priorities', [
            CommandSearchItemAlternative::class => 100,
            CommandSearchItem::class            => 10,
        ]);

        $alternativeFirst = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'itm-1001']));

        $alternativeFirst->assertOk();
        $alternativeFirst->assertJsonPath('data.documents.0.route_name', 'itemAlternatives.show');
        $alternativeFirst->assertJsonPath('data.documents.0.route_params.itemAlternative', $itemAlternative->id);

        config()->set('command_search.model_priorities', [
            CommandSearchItemAlternative::class => 10,
            CommandSearchItem::class            => 100,
        ]);

        $itemFirst = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'itm-1001']));

        $itemFirst->assertOk();
        $itemFirst->assertJsonPath('data.documents.0.route_name', 'items.show');
        $itemFirst->assertJsonPath('data.documents.0.route_params.item', $item->id);
    }

    public function test_configured_model_priority_determines_intent_doctype_model_for_conflicting_matches(): void {
        $this->insertPermission(
            module: 'Inventory',
            name: 'Items',
            model: CommandSearchItem::class,
            route: 'items',
            isSubmitable: true,
        );
        $this->insertPermission(
            module: 'Inventory',
            name: 'Item Alternatives',
            model: CommandSearchItemAlternative::class,
            route: 'itemAlternatives',
            isSubmitable: true,
        );
        $this->insertFormatingSeries(
            model: CommandSearchItem::class,
            name: 'Item',
            format: 'ITM-@[iiii]',
        );
        $this->insertFormatingSeries(
            model: CommandSearchItemAlternative::class,
            name: 'Item Alternative',
            format: 'ITM-@[iiii]',
        );

        $item            = CommandSearchItem::create(['code' => 'ITM-2001']);
        $itemAlternative = CommandSearchItemAlternative::create(['code' => 'ITM-2001']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchItem::class,
            CommandSearchItemAlternative::class,
        ]);

        config()->set('command_search.model_priorities', [
            CommandSearchItemAlternative::class => 100,
            CommandSearchItem::class            => 10,
        ]);

        $alternativeIntent = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'item itm-2001']));

        $alternativeIntent->assertOk();
        $alternativeIntent->assertJsonPath('data.meta.intent.doctype_model', CommandSearchItemAlternative::class);
        $alternativeIntent->assertJsonPath('data.meta.intent.is_scoped', true);
        $alternativeIntent->assertJsonPath('data.meta.intent.is_singular_doctype', true);
        $alternativeIntent->assertJsonPath('data.documents.0.route_name', 'itemAlternatives.show');
        $alternativeIntent->assertJsonPath('data.documents.0.route_params.itemAlternative', $itemAlternative->id);

        config()->set('command_search.model_priorities', [
            CommandSearchItemAlternative::class => 10,
            CommandSearchItem::class            => 100,
        ]);

        $itemIntent = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'item itm-2001']));

        $itemIntent->assertOk();
        $itemIntent->assertJsonPath('data.meta.intent.doctype_model', CommandSearchItem::class);
        $itemIntent->assertJsonPath('data.meta.intent.is_scoped', true);
        $itemIntent->assertJsonPath('data.meta.intent.is_singular_doctype', true);
        $itemIntent->assertJsonPath('data.documents.0.route_name', 'items.show');
        $itemIntent->assertJsonPath('data.documents.0.route_params.item', $item->id);
    }

    public function test_code_tokens_prioritize_documents_over_navigation_for_limited_result_slots(): void {
        $this->seedCorePermissions();
        $purchaseRequest = CommandSearchPurchaseRequest::create(['code' => 'PR-0099']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchPurchaseRequest::class,
        ]);

        $responseLimitOne = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', [
                'q'     => 'pr-0099',
                'limit' => 1,
            ]));

        $responseLimitOne->assertOk();
        $responseLimitOne->assertJsonCount(1, 'data.documents');
        $responseLimitOne->assertJsonCount(1, 'data.navigation');
        $responseLimitOne->assertJsonPath('data.documents.0.route_name', 'purchaseRequests.show');
        $responseLimitOne->assertJsonPath('data.documents.0.route_params.purchaseRequest', $purchaseRequest->id);
        $responseLimitOne->assertJsonPath('data.navigation.0.route_name', 'purchaseRequests.index');

        $responseLimitTwo = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', [
                'q'     => 'pr-0099',
                'limit' => 2,
            ]));

        $responseLimitTwo->assertOk();
        $responseLimitTwo->assertJsonPath('data.documents.0.route_name', 'purchaseRequests.show');
        $responseLimitTwo->assertJsonPath('data.navigation.0.route_name', 'purchaseRequests.index');
    }

    public function test_prefix_query_includes_doctype_navigation_when_matching_document_exists(): void {
        $this->seedCorePermissions();
        $purchaseRequest = CommandSearchPurchaseRequest::create(['code' => 'PR-0110']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchPurchaseRequest::class,
        ]);

        $response = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'pr-']));

        $response->assertOk();
        $response->assertJsonPath('data.documents.0.route_name', 'purchaseRequests.show');
        $response->assertJsonPath('data.documents.0.route_params.purchaseRequest', $purchaseRequest->id);
        $response->assertJsonFragment(['route_name' => 'purchaseRequests.index']);
    }

    public function test_fuzzy_prefix_query_includes_doctype_navigation_when_matching_document_exists(): void {
        $this->seedCorePermissions();
        $purchaseRequest = CommandSearchPurchaseRequest::create(['code' => 'PR-0111']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchPurchaseRequest::class,
        ]);

        $response = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'prr-']));

        $response->assertOk();
        $response->assertJsonPath('data.documents.0.route_name', 'purchaseRequests.show');
        $response->assertJsonPath('data.documents.0.route_params.purchaseRequest', $purchaseRequest->id);
        $response->assertJsonFragment(['route_name' => 'purchaseRequests.index']);
    }

    public function test_format_like_query_without_document_match_does_not_force_navigation(): void {
        $this->seedCorePermissions();
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchPurchaseRequest::class,
        ]);

        $response = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'pr-']));

        $response->assertOk();
        $response->assertJsonCount(0, 'data.documents');
        $response->assertJsonCount(0, 'data.navigation');
    }

    public function test_typo_singular_with_placeholder_token_keeps_scoped_intent_for_item(): void {
        $this->insertPermission(
            module: 'Inventory',
            name: 'Items',
            model: CommandSearchItem::class,
            route: 'items',
            isSubmitable: true,
        );
        $this->insertFormatingSeries(
            model: CommandSearchItem::class,
            name: 'Item',
            format: 'ITM-@[iiii]',
        );

        $item = CommandSearchItem::create(['code' => 'ITM-3001']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchItem::class,
        ]);

        $response = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'itme @[iiii] itm-3001']));

        $response->assertOk();
        $response->assertJsonPath('data.meta.intent.is_scoped', true);
        $response->assertJsonPath('data.meta.intent.is_singular_doctype', true);
        $response->assertJsonPath('data.meta.intent.doctype_model', CommandSearchItem::class);
        $response->assertJsonPath('data.documents.0.route_name', 'items.show');
        $response->assertJsonPath('data.documents.0.route_params.item', $item->id);
    }

    public function test_scoped_items_query_without_item_permission_does_not_leak_item_results(): void {
        $this->seedCorePermissions();
        $this->insertPermission(
            module: 'Inventory',
            name: 'Items',
            model: CommandSearchItem::class,
            route: 'items',
            isSubmitable: true,
        );
        $this->insertFormatingSeries(
            model: CommandSearchItem::class,
            name: 'Item',
            format: 'ITM-@[iiii]',
        );

        CommandSearchPurchaseRequest::create(['code' => 'GDS-0706']);
        CommandSearchItem::create(['code' => 'GDS-0706']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([
            CommandSearchPurchaseRequest::class,
        ]);

        $response = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => 'items gds-0706']));

        $response->assertOk();
        $response->assertJsonMissing(['route_name' => 'items.show']);
        $response->assertJsonMissing(['route_name' => 'items.index']);
    }

    public function test_manual_target_mapping_resolves_expected_document_routes(): void {
        $this->seedCorePermissions();
        $this->seedMappingPermissions();

        $target           = CommandSearchPurchaseRequest::create(['code' => 'PR-MAP-001']);
        $approvalInstance = CommandSearchApprovalInstance::create([
            'document_type' => CommandSearchPurchaseRequest::class,
            'document_id'   => $target->id,
        ]);

        CommandSearchPaymentSchedule::create([
            'payment_scheduleable_type' => CommandSearchPurchaseRequest::class,
            'payment_scheduleable_id'   => $target->id,
            'reference_to'              => $target->code,
        ]);
        CommandSearchApprovalStep::create([
            'approval_instance_id' => $approvalInstance->id,
        ]);
        CommandSearchStockLedger::create([
            'referenceable_type' => CommandSearchPurchaseRequest::class,
            'referenceable_id'   => $target->id,
        ]);

        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $mappedRows = DB::table('commands')
            ->where('type', 'record')
            ->whereIn('source_model_type', [
                CommandSearchPaymentSchedule::class,
                CommandSearchApprovalStep::class,
                CommandSearchStockLedger::class,
            ])
            ->whereNull('deleted_at')
            ->get();
        $this->assertCount(3, $mappedRows);
        foreach ($mappedRows as $row) {
            $this->assertSame('purchaseRequests.show', $row->route_name);
            $params = json_decode($row->route_params, true);
            $this->assertSame($target->id, $params['purchaseRequest'] ?? null);
        }
    }

    public function test_model_lifecycle_events_sync_command_index(): void {
        $this->seedCorePermissions();

        $record = CommandSearchPurchaseRequest::create([
            'code' => 'PR-LIFE-001',
        ]);

        $createdCommand = DB::table('commands')
            ->where('source_model_type', CommandSearchPurchaseRequest::class)
            ->where('source_model_id', $record->id)
            ->whereNull('deleted_at')
            ->first();

        $this->assertNotNull($createdCommand);

        $record->update(['code' => 'PR-LIFE-002']);

        $updatedCommand = DB::table('commands')
            ->where('source_model_type', CommandSearchPurchaseRequest::class)
            ->where('source_model_id', $record->id)
            ->whereNull('deleted_at')
            ->first();

        $this->assertSame('PR-LIFE-002', $updatedCommand->title);

        $record->delete();
        $deletedCommand = DB::table('commands')
            ->where('source_model_type', CommandSearchPurchaseRequest::class)
            ->where('source_model_id', $record->id)
            ->first();

        $this->assertNotNull($deletedCommand->deleted_at);

        $record->restore();
        $restoredCommand = DB::table('commands')
            ->where('source_model_type', CommandSearchPurchaseRequest::class)
            ->where('source_model_id', $record->id)
            ->whereNull('deleted_at')
            ->first();

        $this->assertNotNull($restoredCommand);
        $this->assertSame('PR-LIFE-002', $restoredCommand->title);
    }

    public function test_model_lifecycle_sync_loads_relation_based_template_title(): void {
        $this->insertPermission(
            module: 'Purchase',
            name: 'Purchase Request Relations',
            model: CommandSearchChild::class,
            route: 'purchaseRequests',
        );

        $parent = CommandSearchParent::create([
            'code' => 'PR-REL-001',
        ]);

        $child = CommandSearchChild::create([
            'parent_id' => $parent->id,
        ]);

        $createdCommand = DB::table('commands')
            ->where('source_model_type', CommandSearchChild::class)
            ->where('source_model_id', $child->id)
            ->whereNull('deleted_at')
            ->first();

        $this->assertNotNull($createdCommand);
        $this->assertSame('PR-REL-001', $createdCommand->title);
    }

    public function test_permission_update_self_heals_navigation_index(): void {
        $this->seedCorePermissions();
        CommandSearchPurchaseRequest::create(['code' => 'PR-SELF-001']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        DB::table('commands')->where('type', 'navigation')->delete();

        $permission = PermissionModel::query()
            ->where('model', CommandSearchPurchaseRequest::class)
            ->firstOrFail();
        $permission->update(['name' => 'Purchase Requests Updated']);

        $navigation = DB::table('commands')
            ->where('type', 'navigation')
            ->where('route_name', 'purchaseRequests.index')
            ->whereNull('deleted_at')
            ->first();

        $this->assertNotNull($navigation);
    }

    public function test_track_recent_creates_row_then_updates_existing_row_without_duplicates(): void {
        $this->seedCorePermissions();
        $purchaseRequest = CommandSearchPurchaseRequest::create(['code' => 'PR-REC-001']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $command = DB::table('commands')
            ->where('route_name', 'purchaseRequests.show')
            ->whereNull('deleted_at')
            ->where('target_model_id', $purchaseRequest->id)
            ->first();
        $this->assertNotNull($command);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([CommandSearchPurchaseRequest::class]);

        try {
            Carbon::setTestNow(Carbon::parse('2026-05-16 10:00:00'));
            $this->actingAs($authUser)
                ->withSession(['permissions' => $sessionPermissions])
                ->postJson(route('commands.recent.track'), [
                    'command' => [
                        'signature' => $command->signature,
                    ],
                ])
                ->assertOk();

            $firstRecent = DB::table('command_recents')->first();
            $this->assertNotNull($firstRecent);
            $this->assertSame($command->signature, $firstRecent->recent_key);

            Carbon::setTestNow(Carbon::parse('2026-05-16 10:05:00'));
            $this->actingAs($authUser)
                ->withSession(['permissions' => $sessionPermissions])
                ->postJson(route('commands.recent.track'), [
                    'command' => [
                        'signature' => $command->signature,
                    ],
                ])
                ->assertOk();

            $allRecentRows = DB::table('command_recents')->get();
            $this->assertCount(1, $allRecentRows);

            $latestRecent = $allRecentRows->first();
            $this->assertSame($firstRecent->id, $latestRecent->id);
            $this->assertTrue(Carbon::parse($latestRecent->updated_at)->greaterThan(Carbon::parse($firstRecent->updated_at)));
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_track_recent_restores_soft_deleted_row_instead_of_creating_new_row(): void {
        $this->seedCorePermissions();
        $purchaseRequest = CommandSearchPurchaseRequest::create(['code' => 'PR-REC-002']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $command = DB::table('commands')
            ->where('route_name', 'purchaseRequests.show')
            ->whereNull('deleted_at')
            ->where('target_model_id', $purchaseRequest->id)
            ->first();
        $this->assertNotNull($command);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([CommandSearchPurchaseRequest::class]);

        $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->postJson(route('commands.recent.track'), [
                'command' => [
                    'signature' => $command->signature,
                ],
            ])
            ->assertOk();

        $initialRecent = DB::table('command_recents')->first();
        $this->assertNotNull($initialRecent);

        $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->deleteJson(route('commands.recent.remove'), [
                'recent_key' => $initialRecent->recent_key,
            ])
            ->assertOk();

        $softDeleted = DB::table('command_recents')->where('id', $initialRecent->id)->first();
        $this->assertNotNull($softDeleted->deleted_at);

        $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->postJson(route('commands.recent.track'), [
                'command' => [
                    'signature' => $command->signature,
                ],
            ])
            ->assertOk();

        $rowsWithSameKey = DB::table('command_recents')
            ->where('recent_key', $initialRecent->recent_key)
            ->get();

        $this->assertCount(1, $rowsWithSameKey);
        $this->assertNull($rowsWithSameKey->first()->deleted_at);
        $this->assertSame($initialRecent->id, $rowsWithSameKey->first()->id);
    }

    public function test_delete_recent_per_item_soft_deletes_only_target_row(): void {
        $this->seedCorePermissions();
        $firstRequest  = CommandSearchPurchaseRequest::create(['code' => 'PR-REC-003']);
        $secondRequest = CommandSearchPurchaseRequest::create(['code' => 'PR-REC-004']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $commands = DB::table('commands')
            ->where('route_name', 'purchaseRequests.show')
            ->whereIn('target_model_id', [$firstRequest->id, $secondRequest->id])
            ->whereNull('deleted_at')
            ->orderBy('target_model_id')
            ->get();
        $this->assertCount(2, $commands);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([CommandSearchPurchaseRequest::class]);

        foreach ($commands as $command) {
            $this->actingAs($authUser)
                ->withSession(['permissions' => $sessionPermissions])
                ->postJson(route('commands.recent.track'), [
                    'command' => [
                        'signature' => $command->signature,
                    ],
                ])
                ->assertOk();
        }

        $activeRecent = DB::table('command_recents')->whereNull('deleted_at')->orderBy('recent_key')->get();
        $this->assertCount(2, $activeRecent);

        $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->deleteJson(route('commands.recent.remove'), [
                'recent_key' => $activeRecent->first()->recent_key,
            ])
            ->assertOk();

        $remainingActive = DB::table('command_recents')->whereNull('deleted_at')->get();
        $this->assertCount(1, $remainingActive);
        $this->assertSame($activeRecent->last()->recent_key, $remainingActive->first()->recent_key);

        $softDeletedCount = DB::table('command_recents')->whereNotNull('deleted_at')->count();
        $this->assertSame(1, $softDeletedCount);
    }

    public function test_clear_all_recent_soft_deletes_all_active_rows(): void {
        $this->seedCorePermissions();
        $firstRequest  = CommandSearchPurchaseRequest::create(['code' => 'PR-REC-005']);
        $secondRequest = CommandSearchPurchaseRequest::create(['code' => 'PR-REC-006']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $commands = DB::table('commands')
            ->where('route_name', 'purchaseRequests.show')
            ->whereIn('target_model_id', [$firstRequest->id, $secondRequest->id])
            ->whereNull('deleted_at')
            ->get();
        $this->assertCount(2, $commands);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([CommandSearchPurchaseRequest::class]);

        foreach ($commands as $command) {
            $this->actingAs($authUser)
                ->withSession(['permissions' => $sessionPermissions])
                ->postJson(route('commands.recent.track'), [
                    'command' => [
                        'signature' => $command->signature,
                    ],
                ])
                ->assertOk();
        }

        $this->assertSame(2, DB::table('command_recents')->whereNull('deleted_at')->count());

        $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->deleteJson(route('commands.recent.remove'))
            ->assertOk();

        $this->assertSame(0, DB::table('command_recents')->whereNull('deleted_at')->count());
        $this->assertSame(2, DB::table('command_recents')->whereNotNull('deleted_at')->count());
    }

    public function test_empty_query_returns_only_recent_sorted_latest_and_limited_to_five(): void {
        $this->seedCorePermissions();
        foreach (range(1, 6) as $index) {
            CommandSearchPurchaseRequest::create([
                'code' => sprintf('PR-REC-LIST-%03d', $index),
            ]);
        }
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $commands = DB::table('commands')
            ->where('route_name', 'purchaseRequests.show')
            ->whereNull('deleted_at')
            ->orderBy('title')
            ->get();
        $this->assertCount(6, $commands);

        $authUser           = $this->makeAuthUser();
        $sessionPermissions = $this->makeSessionPermissions([CommandSearchPurchaseRequest::class]);

        try {
            $currentTime = Carbon::parse('2026-05-16 09:00:00');
            foreach ($commands as $command) {
                Carbon::setTestNow($currentTime);
                $this->actingAs($authUser)
                    ->withSession(['permissions' => $sessionPermissions])
                    ->postJson(route('commands.recent.track'), [
                        'command' => [
                            'signature' => $command->signature,
                        ],
                    ])
                    ->assertOk();
                $currentTime = $currentTime->copy()->addMinute();
            }
        } finally {
            Carbon::setTestNow();
        }

        $response = $this->actingAs($authUser)
            ->withSession(['permissions' => $sessionPermissions])
            ->getJson(route('commands.search', ['q' => '']));

        $response->assertOk();
        $response->assertJsonCount(0, 'data.navigation');
        $response->assertJsonCount(0, 'data.documents');
        $response->assertJsonCount(5, 'data.recent');

        $expectedRecentKeys = collect($commands->pluck('signature')->all())
            ->slice(-5)
            ->reverse()
            ->values()
            ->all();
        $actualRecentKeys = collect($response->json('data.recent'))
            ->pluck('recent_key')
            ->values()
            ->all();

        $this->assertSame($expectedRecentKeys, $actualRecentKeys);
    }

    public function test_recent_results_are_filtered_by_user_permissions(): void {
        $this->seedCorePermissions();
        $purchaseRequest = CommandSearchPurchaseRequest::create(['code' => 'PR-REC-007']);
        $this->artisan('commands:index --rebuild')->assertExitCode(0);

        $command = DB::table('commands')
            ->where('route_name', 'purchaseRequests.show')
            ->whereNull('deleted_at')
            ->where('target_model_id', $purchaseRequest->id)
            ->first();
        $this->assertNotNull($command);

        $authUser = $this->makeAuthUser();

        $this->actingAs($authUser)
            ->withSession([
                'permissions' => $this->makeSessionPermissions([CommandSearchPurchaseRequest::class]),
            ])
            ->postJson(route('commands.recent.track'), [
                'command' => [
                    'signature' => $command->signature,
                ],
            ])
            ->assertOk();

        $response = $this->actingAs($authUser)
            ->withSession([
                'permissions' => $this->makeSessionPermissions([CommandSearchUserModel::class]),
            ])
            ->getJson(route('commands.search', ['q' => '']));

        $response->assertOk();
        $response->assertJsonCount(0, 'data.recent');
    }

    private function seedCorePermissions(): void {
        $this->insertPermission(
            module: 'User',
            name: 'Users',
            model: CommandSearchUserModel::class,
            route: 'users',
        );

        $this->insertPermission(
            module: 'Purchase',
            name: 'Purchase Requests',
            model: CommandSearchPurchaseRequest::class,
            route: 'purchaseRequests',
            isSubmitable: true,
        );
        $this->insertFormatingSeries(
            model: CommandSearchPurchaseRequest::class,
            name: 'Purchase Request',
            format: 'PR-@[iiii]',
        );
    }

    private function seedMappingPermissions(): void {
        $this->insertPermission(
            module: 'Finances',
            name: 'Payment Schedules',
            model: CommandSearchPaymentSchedule::class,
            route: 'paymentSchedules',
        );
        $this->insertPermission(
            module: 'Approvals',
            name: 'Approval Steps',
            model: CommandSearchApprovalStep::class,
            route: 'approvalSteps',
        );
        $this->insertPermission(
            module: 'Inventory',
            name: 'Stock Ledgers',
            model: CommandSearchStockLedger::class,
            route: 'stockLedgers',
        );
    }

    private function insertPermission(string $module, string $name, string $model, string $route, bool $isSubmitable = false): void {
        DB::table('permissions')->insert([
            'id'                 => (string) str()->ulid(),
            'module'             => $module,
            'name'               => $name,
            'model'              => $model,
            'route'              => $route,
            'permissions'        => json_encode(['select', 'read']),
            'is_submitable'      => $isSubmitable,
            'allow_only_creator' => false,
            'created_at'         => now(),
            'updated_at'         => now(),
            'deleted_at'         => null,
        ]);
    }

    private function insertFormatingSeries(string $model, string $name, string $format): void {
        DB::table('formating_series')->insert([
            'id'         => (string) str()->ulid(),
            'name'       => $name,
            'model'      => $model,
            'logs'       => json_encode([]),
            'format'     => $format,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeAuthUser(): CommandSearchAuthUser {
        DB::table('users')->insert([
            'id'         => (string) str()->ulid(),
            'name'       => 'Tester',
            'email'      => 'tester@example.com',
            'password'   => null,
            'status'     => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return CommandSearchAuthUser::query()->firstOrFail();
    }

    /**
     * @param  string[]  $models
     * @return array<string, mixed>
     */
    private function makeSessionPermissions(array $models): array {
        $permissions = [];
        foreach ($models as $model) {
            $permissions[$model] = [
                0 => [
                    'false' => [
                        [
                            'model'        => $model,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                            ],
                        ],
                    ],
                ],
            ];
        }

        return $permissions;
    }
}

class CommandSearchAuthUser extends Authenticatable {
    protected $table   = 'users';
    protected $guarded = [];
}

class CommandSearchUserModel extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'command_search_users';
    protected $guarded = ['id'];

    public static function templateLink() {
        return ':name';
    }
}

class CommandSearchPurchaseRequest extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'command_search_purchase_requests';
    protected $guarded = ['id'];

    public static function templateLink() {
        return ':code';
    }
}

class CommandSearchPaymentSchedule extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'command_search_payment_schedules';
    protected $guarded = ['id'];

    public static function templateLink() {
        return ':referenceTo';
    }

    public function referenceTo() {
        return $this->morphTo('payment_scheduleable');
    }
}

class CommandSearchApprovalInstance extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'command_search_approval_instances';
    protected $guarded = ['id'];

    public function document() {
        return $this->morphTo('document', 'document_type', 'document_id');
    }
}

class CommandSearchApprovalStep extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'command_search_approval_steps';
    protected $guarded = ['id'];

    public static function templateLink() {
        return ':approvalInstance.document';
    }

    public function approvalInstance() {
        return $this->belongsTo(CommandSearchApprovalInstance::class, 'approval_instance_id');
    }
}

class CommandSearchStockLedger extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'command_search_stock_ledgers';
    protected $guarded = ['id'];

    public static function templateLink() {
        return ':referenceable';
    }

    public function referenceable() {
        return $this->morphTo();
    }
}

class CommandSearchSalesOrder extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'command_search_sales_orders';
    protected $guarded = ['id'];

    public static function templateLink() {
        return ':code';
    }
}

class CommandSearchParent extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'command_search_parents';
    protected $guarded = ['id'];

    public static function templateLink() {
        return ':code';
    }
}

class CommandSearchChild extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'command_search_children';
    protected $guarded = ['id'];

    public static function templateLink() {
        return ':parent.code';
    }

    protected static function loadRelationsOnShow() {
        return ['parent'];
    }

    public function parent() {
        return $this->belongsTo(CommandSearchParent::class, 'parent_id');
    }
}

class CommandSearchItem extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'command_search_items';
    protected $guarded = ['id'];

    public static function templateLink() {
        return ':code';
    }
}

class CommandSearchItemAlternative extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'command_search_item_alternatives';
    protected $guarded = ['id'];

    public static function templateLink() {
        return ':code';
    }
}
