<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Http\Middleware\ResolveActiveDesk;
use App\Models\Core\Branch;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseRequest;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PurchaseOrderFromRequestsStageTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private array $permissions;

    protected function setUp(): void {
        parent::setUp();
        $this->withoutMiddleware([
            AppMiddleware::class, EnsureUserIsOnboarded::class, HandleInertiaRequests::class,
            LanguageMiddleware::class, ResolveActiveDesk::class, QueryDetectorMiddleware::class,
        ]);
        if (! Schema::hasColumn('users', 'is_example')) {
            Schema::table('users', fn ($table) => $table->boolean('is_example')->default(false));
        }
        PurchaseRequest::initPermissions();
        $this->user = User::factory()->create();
        $this->actingAs($this->user);
        foreach ([PurchaseOrder::class => ['create' => true], PurchaseRequest::class => ['select' => true, 'read' => true]] as $model => $actions) {
            $this->permissions[$model] = [0 => [[
                'model' => $model, 'level' => 0, 'only_creator' => false, 'permissions' => $actions,
            ]]];
        }
        $this->withSession(['permissions' => $this->permissions, 'currentBranch' => null]);
        $this->withHeader('X-Inertia', 'true');
    }

    private function makeRequest(array $attributes = [], int $itemCount = 1): PurchaseRequest {
        $purchaseRequest = PurchaseRequest::create([
            'date'   => now(), 'required_date' => now()->addWeek(),
            'code'   => 'PR-' . fake()->unique()->numerify('#####'),
            'status' => [FormStatus::TO_ORDER], 'external_note' => 'Catatan lengkap PR',
            ...$attributes,
        ]);
        for ($index = 0; $index < $itemCount; $index++) {
            $variant  = ItemVariant::factory()->create();
            $unit     = Unit::create(['name' => 'Pieces', 'code' => fake()->unique()->bothify('PCS-####')]);
            $itemUnit = ItemUnit::create(['item_id' => $variant->item_id, 'unit_id' => $unit->id, 'conversion_factor' => 1]);
            $purchaseRequest->items()->create([
                'item_variant_id' => $variant->id, 'item_unit_id' => $itemUnit->id,
                'quantity'        => 10, 'ordered_quantity' => 2,
                'description'     => 'Detail item sumber', 'required_date' => now()->addDays(3),
            ]);
        }

        return $purchaseRequest->fresh();
    }

    private function stage(array $ids): string {
        $response = $this->post(route('purchaseOrders.fromRequests.stage'), ['ids' => $ids])->assertRedirect();
        $token    = basename(parse_url($response->headers->get('Location'), PHP_URL_PATH));
        $response->assertRedirect(route('purchaseOrders.fromRequests.show', $token));

        return $token;
    }

    public function test_single_and_multiple_requests_provide_fresh_items_notes_and_reusable_token(): void {
        $first  = $this->makeRequest();
        $second = $this->makeRequest();
        $this->stage([$first->id]);
        $token   = $this->stage([$first->id, $second->id]);
        $context = session("purchase_order_from_requests.{$token}");
        $this->assertSame([$first->id, $second->id], $context['ids']);
        $this->assertSame($this->user->id, $context['user_id']);
        $this->assertNull($context['branch_id']);
        $this->assertGreaterThan(now()->timestamp, $context['expires_at']);
        $this->assertArrayNotHasKey('items', $context);
        $first->items()->first()->update(['ordered_quantity' => 4]);
        for ($attempt = 0; $attempt < 2; $attempt++) {
            $response = $this->getJson(route('purchaseOrders.fromRequests.show', $token))->assertOk();
            $response->assertJsonPath('component', 'Purchase/PurchaseOrders/FromRequests/Workspace')
                ->assertJsonPath('props.token', $token)
                ->assertJsonCount(2, 'props.sources')
                ->assertJsonPath('props.sources.0.id', $first->id)
                ->assertJsonPath('props.sources.0.external_note', $first->external_note)
                ->assertJsonPath('props.sources.0.items.0.unordered_quantity', 6)
                ->assertJsonPath('props.sources.0.items.0.purchase_request_id', $first->id)
                ->assertJsonPath('props.sources.0.items.0.item.id', $first->items->first()->item_variant_id)
                ->assertJsonPath('props.sources.0.items.0.unit.id', $first->items->first()->item_unit_id);
        }
        $this->assertNotNull(session("purchase_order_from_requests.{$token}"));
    }

    public static function invalidIds(): array {
        return [
            'empty'      => [[]], 'scalar' => ['invalid'], 'malformed' => [['invalid']],
            'non-string' => [[123]], 'nested' => [[['id' => (string) Str::ulid()]]],
            'not a list' => [['source' => (string) Str::ulid()]],
            'duplicate'  => [[str_repeat('0', 26), str_repeat('0', 26)]],
            'too many'   => [array_map(fn () => (string) Str::ulid(), range(1, 501))],
        ];
    }

    #[DataProvider('invalidIds')]
    public function test_invalid_selection_is_rejected(mixed $ids): void {
        $this->postJson(route('purchaseOrders.fromRequests.stage'), ['ids' => $ids])->assertUnprocessable();
        $this->assertEmpty(session('purchase_order_from_requests', []));
    }

    public static function missingPermissions(): array {
        return [[PurchaseOrder::class, 'create'], [PurchaseRequest::class, 'select'], [PurchaseRequest::class, 'read']];
    }

    #[DataProvider('missingPermissions')]
    public function test_stage_and_workspace_require_all_permissions(string $model, string $action): void {
        $purchaseRequest                                         = $this->makeRequest();
        $token                                                   = $this->stage([$purchaseRequest->id]);
        $this->permissions[$model][0][0]['permissions'][$action] = false;
        $this->withSession(['permissions' => $this->permissions]);
        $this->postJson(route('purchaseOrders.fromRequests.stage'), ['ids' => [$purchaseRequest->id]])->assertForbidden();
        $this->getJson(route('purchaseOrders.fromRequests.show', $token))->assertForbidden();
    }

    public function test_only_creator_restricts_each_pr_permission(): void {
        $own   = $this->makeRequest();
        $other = $this->makeRequest(['created_by_id' => User::factory()->create()->id]);
        foreach (['select', 'read'] as $action) {
            $this->permissions[PurchaseRequest::class][0] = [
                ['only_creator' => true, 'permissions' => [$action => true]],
                ['only_creator' => false, 'permissions' => [($action === 'read' ? 'select' : 'read') => true]],
            ];
            $this->withSession(['permissions' => $this->permissions]);
            $this->stage([$own->id]);
            $this->postJson(route('purchaseOrders.fromRequests.stage'), ['ids' => [$own->id, $other->id]])->assertForbidden();
        }
    }

    public function test_requests_outside_active_branch_are_rejected_even_for_main_branch_users(): void {
        $main  = Branch::factory()->create(['is_main_branch' => true]);
        $other = Branch::factory()->create();
        $this->user->branches()->attach($main);
        $own     = $this->makeRequest(['branch_id' => $main->id]);
        $foreign = $this->makeRequest(['branch_id' => $other->id]);
        $this->withSession(['currentBranch' => $main->id]);
        $this->stage([$own->id]);
        $this->postJson(route('purchaseOrders.fromRequests.stage'), ['ids' => [$foreign->id]])->assertForbidden();
    }

    public function test_ineligible_deleted_and_missing_requests_do_not_create_partial_context(): void {
        $valid = $this->makeRequest();
        $draft = $this->makeRequest(['status' => [FormStatus::DRAFT]]);
        $this->postJson(route('purchaseOrders.fromRequests.stage'), ['ids' => [$valid->id, $draft->id]])
            ->assertUnprocessable()->assertJsonValidationErrors('ids.1');
        $this->assertEmpty(session('purchase_order_from_requests', []));
        $empty = $this->makeRequest();
        $empty->items()->update(['ordered_quantity' => 10]);
        $this->postJson(route('purchaseOrders.fromRequests.stage'), ['ids' => [$empty->id]])->assertUnprocessable();
        DB::table('purchase_requests')->where('id', $valid->id)->update(['deleted_at' => now()]);
        foreach ([$valid->id, (string) Str::ulid()] as $id) {
            $this->postJson(route('purchaseOrders.fromRequests.stage'), ['ids' => [$id]])->assertForbidden();
        }
    }

    public function test_stale_workspace_reports_source_error_without_consuming_token(): void {
        $purchaseRequest = $this->makeRequest();
        $token           = $this->stage([$purchaseRequest->id]);
        $purchaseRequest->update(['status' => [FormStatus::CLOSED]]);
        $this->getJson(route('purchaseOrders.fromRequests.show', $token))->assertOk()
            ->assertJsonCount(0, 'props.sources')
            ->assertJsonStructure(['props' => ['sourceErrors' => ['ids.0']]]);
        $this->assertNotNull(session("purchase_order_from_requests.{$token}"));
    }

    public function test_workspace_rechecks_ownership_and_guest_access_is_blocked(): void {
        $purchaseRequest                                                 = $this->makeRequest();
        $token                                                           = $this->stage([$purchaseRequest->id]);
        $this->permissions[PurchaseRequest::class][0][0]['only_creator'] = true;
        $this->withSession(['permissions' => $this->permissions]);
        $purchaseRequest->update(['created_by_id' => User::factory()->create()->id]);
        $this->getJson(route('purchaseOrders.fromRequests.show', $token))->assertForbidden();
        auth()->logout();
        $this->postJson(route('purchaseOrders.fromRequests.stage'), ['ids' => [$purchaseRequest->id]])->assertUnauthorized();
        $this->getJson(route('purchaseOrders.fromRequests.show', $token))->assertUnauthorized();
    }

    public function test_tokens_are_bound_to_user_branch_and_expiry(): void {
        $purchaseRequest = $this->makeRequest();
        $token           = $this->stage([$purchaseRequest->id]);
        $this->actingAs(User::factory()->create());
        $this->getJson(route('purchaseOrders.fromRequests.show', $token))->assertForbidden();
        $this->actingAs($this->user)->withSession(['currentBranch' => (string) Str::ulid()]);
        $this->getJson(route('purchaseOrders.fromRequests.show', $token))->assertForbidden();
        $this->withSession(['currentBranch' => null]);
        $this->travel(121)->minutes();
        $this->getJson(route('purchaseOrders.fromRequests.show', $token))->assertNotFound();
        $this->assertNull(session("purchase_order_from_requests.{$token}"));
        $this->getJson(route('purchaseOrders.fromRequests.show', (string) Str::ulid()))->assertNotFound();
    }

    public function test_completed_items_are_excluded_and_loading_does_not_scale_queries_per_row(): void {
        $single = $this->makeRequest();
        $many   = $this->makeRequest(itemCount: 8);
        $many->items()->first()->update(['ordered_quantity' => 10]);
        $tokens  = [$this->stage([$single->id]), $this->stage([$single->id, $many->id])];
        $queries = [];
        DB::listen(function ($query) use (&$queries): void {
            if (str_starts_with(strtolower($query->sql), 'select ') && ! str_contains($query->sql, 'pragma_')) {
                $queries[] = $query->sql;
            }
        });
        $this->getJson(route('purchaseOrders.fromRequests.show', $tokens[0]))->assertOk();
        $singleCount = count($queries);
        $queries     = [];
        $this->getJson(route('purchaseOrders.fromRequests.show', $tokens[1]))->assertOk()->assertJsonCount(7, 'props.sources.1.items');
        $this->assertLessThanOrEqual($singleCount + 1, count($queries), implode("\n", $queries));
    }
}
