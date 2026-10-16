<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Http\Middleware\ResolveActiveDesk;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Model;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderBatchSubmission;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\User\User;
use App\Services\Purchase\PurchaseOrderService;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\WarehouseFactory;
use Database\Factories\Purchase\SupplierFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PurchaseOrderFromRequestsStoreTest extends TestCase {
    use RefreshDatabase;

    private string $supplierId;
    private string $otherSupplierId;
    private string $warehouseId;
    private string $branchId;

    protected function setUp(): void {
        parent::setUp();
        $this->withoutMiddleware([
            AppMiddleware::class, EnsureUserIsOnboarded::class, HandleInertiaRequests::class,
            LanguageMiddleware::class, ResolveActiveDesk::class, QueryDetectorMiddleware::class,
        ]);
        if (! Schema::hasColumn('users', 'is_example')) {
            Schema::table('users', fn ($table) => $table->boolean('is_example')->default(false));
        }
        FormatingSeries::initPermissions();
        PurchaseOrder::initPermissions();
        PurchaseRequest::initPermissions();
        $this->branchId = Branch::factory()->create()->id;
        $this->actingAs(User::factory()->create())->withSession([
            'permissions' => [
                PurchaseOrder::class   => [0 => [['model' => PurchaseOrder::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['create' => true]]]],
                PurchaseRequest::class => [0 => [['model' => PurchaseRequest::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true, 'read' => true]]]],
            ],
            'currentBranch' => $this->branchId,
        ]);
        $this->withHeader('X-Inertia', 'true');
        $country               = CountryFactory::new()->createQuietly();
        $this->supplierId      = $this->makeSupplier($country->code);
        $this->otherSupplierId = $this->makeSupplier($country->code);
        $this->warehouseId     = WarehouseFactory::new()->createQuietly()->id;
    }

    private function makeSupplier(string $countryCode): string {
        $supplier = SupplierFactory::new()->make(['country_id' => $countryCode]);
        unset($supplier->parent_id);
        $supplier->saveQuietly();

        return $supplier->id;
    }

    private function makeRequest(): PurchaseRequest {
        $purchaseRequest = PurchaseRequest::create([
            'date'      => now(), 'required_date' => now()->addWeek(),
            'code'      => 'PR-' . fake()->unique()->numerify('#####'),
            'status'    => [FormStatus::TO_ORDER],
            'branch_id' => $this->branchId,
        ]);
        $variant  = ItemVariant::factory()->create();
        $unit     = Unit::withoutEvents(fn () => Unit::create(['name' => 'Pieces', 'code' => fake()->unique()->bothify('PCS-####')]));
        $itemUnit = ItemUnit::withoutEvents(fn () => ItemUnit::create([
            'item_id' => $variant->item_id, 'unit_id' => $unit->id, 'conversion_factor' => 1,
        ]));
        $purchaseRequest->items()->create([
            'item_variant_id' => $variant->id, 'item_unit_id' => $itemUnit->id,
            'quantity'        => 10, 'ordered_quantity' => 0, 'required_date' => now()->addDays(3),
        ]);

        return $purchaseRequest->fresh('items');
    }

    private function stage(array $purchaseRequests): string {
        $response = $this->post(route('purchaseOrders.fromRequests.stage'), [
            'ids' => array_map(fn (PurchaseRequest $purchaseRequest) => $purchaseRequest->id, $purchaseRequests),
        ])->assertRedirect();
        $token = basename(parse_url($response->headers->get('Location'), PHP_URL_PATH));
        $this->getJson(route('purchaseOrders.fromRequests.show', $token))->assertOk();

        return $token;
    }

    private function draft(PurchaseRequestItem $source, string $supplierId, string $draftId, string $allocationId, float $quantity = 10): array {
        return [
            'id'            => $draftId,
            'supplier'      => ['id' => $supplierId],
            'date'          => now()->toDateString(),
            'required_date' => now()->addWeek()->toDateString(),
            'items'         => [[
                'id'               => $allocationId,
                'source_item_id'   => $source->id,
                'item'             => ['id' => $source->item_variant_id],
                'unit'             => ['id' => $source->item_unit_id],
                'target_warehouse' => ['id' => $this->warehouseId],
                'required_date'    => now()->addDays(3)->toDateString(),
                'quantity'         => $quantity,
                'rate'             => 100,
            ]],
        ];
    }

    private function payload(string $token, array $drafts, ?string $key = null): array {
        return ['token' => $token, 'idempotency_key' => $key ?? (string) Str::uuid(), 'drafts' => $drafts];
    }

    public function test_multiple_requests_can_become_one_draft_with_source_references(): void {
        $first            = $this->makeRequest();
        $second           = $this->makeRequest();
        $token            = $this->stage([$first, $second]);
        $draft            = $this->draft($first->items->first(), $this->supplierId, 'draft-1', 'allocation-1');
        $draft['items'][] = $this->draft($second->items->first(), $this->supplierId, 'draft-2', 'allocation-2')['items'][0];

        $response = $this->post(route('purchaseOrders.fromRequests.store'), $this->payload($token, [$draft]))->assertRedirect();

        $this->assertSame(1, PurchaseOrder::count());
        $purchaseOrder = PurchaseOrder::firstOrFail();
        $this->assertContains(FormStatus::DRAFT, $purchaseOrder->status);
        $this->assertSame($this->supplierId, $purchaseOrder->supplier_id);
        $this->assertEqualsCanonicalizing(
            [$first->items->first()->id, $second->items->first()->id],
            $purchaseOrder->items->pluck('referenceable_id')->all(),
        );
        $this->assertTrue($purchaseOrder->items->every(fn ($item) => $item->referenceable_type === PurchaseRequestItem::class));
        $this->assertSame(0.0, (float) $first->items->first()->fresh()->ordered_quantity);
        $this->assertSame(0.0, (float) $second->items->first()->fresh()->ordered_quantity);
        $resultKey = basename(parse_url($response->headers->get('Location'), PHP_URL_PATH));
        $this->getJson(route('purchaseOrders.fromRequests.result', $resultKey))
            ->assertOk()
            ->assertJsonCount(1, 'props.purchaseOrders')
            ->assertJsonPath('props.purchaseOrders.0.items_count', 2);
        $this->assertNull(session("purchase_order_from_requests.{$token}"));
    }

    public function test_supplier_groups_and_manual_same_supplier_split_create_separate_drafts(): void {
        $first  = $this->makeRequest();
        $second = $this->makeRequest();
        $token  = $this->stage([$first, $second]);
        $drafts = [
            $this->draft($first->items->first(), $this->supplierId, 'draft-1', 'allocation-1', 3),
            $this->draft($first->items->first(), $this->otherSupplierId, 'draft-2', 'allocation-2', 7),
            $this->draft($second->items->first(), $this->supplierId, 'draft-3', 'allocation-3', 14),
        ];

        $this->post(route('purchaseOrders.fromRequests.store'), $this->payload($token, $drafts))->assertRedirect();

        $this->assertSame(3, PurchaseOrder::count());
        $this->assertSame(2, PurchaseOrder::where('supplier_id', $this->supplierId)->count());
        $this->assertSame(1, PurchaseOrder::where('supplier_id', $this->otherSupplierId)->count());
        $this->assertSame(2, PurchaseOrderItem::where('referenceable_id', $first->items->first()->id)->count());
        $this->assertSame(0.0, (float) $first->items->first()->fresh()->ordered_quantity);
    }

    public function test_approval_of_two_drafts_accumulates_ordered_quantity_for_shared_pr_item(): void {
        $purchaseRequest = $this->makeRequest();
        $source          = $purchaseRequest->items->first();
        $box             = Unit::withoutEvents(fn () => Unit::create(['name' => 'Box', 'code' => fake()->unique()->bothify('BOX-####')]));
        $boxUnit         = ItemUnit::withoutEvents(fn () => ItemUnit::create([
            'item_id'           => ItemVariant::findOrFail($source->item_variant_id)->item_id,
            'unit_id'           => $box->id,
            'conversion_factor' => 12,
        ]));
        $token  = $this->stage([$purchaseRequest]);
        $drafts = [
            $this->draft($source, $this->supplierId, 'draft-1', 'allocation-1', 3),
            $this->draft($source, $this->otherSupplierId, 'draft-2', 'allocation-2', 2),
        ];
        $drafts[1]['items'][0]['unit']['id'] = $boxUnit->id;

        $this->post(route('purchaseOrders.fromRequests.store'), $this->payload($token, $drafts))->assertRedirect();
        $this->assertSame(0.0, (float) $source->fresh()->ordered_quantity);

        foreach (PurchaseOrder::query()->orderBy('created_at')->orderBy('id')->get() as $purchaseOrder) {
            app(PurchaseOrderService::class)->onApproved($purchaseOrder);
        }

        $this->assertSame(27.0, (float) $source->fresh()->ordered_quantity);
    }

    public function test_approval_uses_source_conversion_factor_and_fractional_po_factor(): void {
        $purchaseRequest = $this->makeRequest();
        $source          = $purchaseRequest->items->first();
        ItemUnit::findOrFail($source->item_unit_id)->updateQuietly(['conversion_factor' => 2]);
        $source->updateQuietly(['conversion_factor' => 2]);
        $unit     = Unit::withoutEvents(fn () => Unit::create(['name' => 'Pack', 'code' => fake()->unique()->bothify('PK-####')]));
        $packUnit = ItemUnit::withoutEvents(fn () => ItemUnit::create([
            'item_id'           => ItemVariant::findOrFail($source->item_variant_id)->item_id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 1.5,
        ]));
        $token                           = $this->stage([$purchaseRequest]);
        $draft                           = $this->draft($source, $this->supplierId, 'draft-1', 'allocation-1', 4);
        $draft['items'][0]['unit']['id'] = $packUnit->id;

        $this->post(route('purchaseOrders.fromRequests.store'), $this->payload($token, [$draft]))->assertRedirect();
        app(PurchaseOrderService::class)->onApproved(PurchaseOrder::firstOrFail());

        $this->assertSame(3.0, (float) $source->fresh()->ordered_quantity);
    }

    public function test_approval_converts_each_reference_edge_in_an_upstream_chain(): void {
        $upstreamRequest = $this->makeRequest();
        $upstream        = $upstreamRequest->items->first();
        $upstream->updateQuietly(['conversion_factor' => 4]);
        $purchaseRequest = $this->makeRequest();
        $source          = $purchaseRequest->items->first();
        $source->updateQuietly([
            'conversion_factor'  => 2,
            'referenceable_type' => PurchaseRequestItem::class,
            'referenceable_id'   => $upstream->id,
        ]);
        $unit    = Unit::withoutEvents(fn () => Unit::create(['name' => 'Box', 'code' => fake()->unique()->bothify('BOX-####')]));
        $boxUnit = ItemUnit::withoutEvents(fn () => ItemUnit::create([
            'item_id'           => ItemVariant::findOrFail($source->item_variant_id)->item_id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 12,
        ]));
        $token                           = $this->stage([$purchaseRequest]);
        $draft                           = $this->draft($source, $this->supplierId, 'draft-1', 'allocation-1', 2);
        $draft['items'][0]['unit']['id'] = $boxUnit->id;

        $this->post(route('purchaseOrders.fromRequests.store'), $this->payload($token, [$draft]))->assertRedirect();
        app(PurchaseOrderService::class)->onApproved(PurchaseOrder::firstOrFail());

        $this->assertSame(12.0, (float) $source->fresh()->ordered_quantity);
        $upstreamConnection = ModelConnection::query()
            ->where('model_type', PurchaseRequestItem::class)
            ->where('model_id', $upstream->id)
            ->where('reference_type', PurchaseRequestItem::class)
            ->where('reference_id', $source->id)
            ->firstOrFail();
        $this->assertSame(6.0, (float) $upstreamConnection->data['ordered_quantity']);
    }

    public function test_invalid_source_factor_rolls_back_approval_and_connections(): void {
        $purchaseRequest = $this->makeRequest();
        $source          = $purchaseRequest->items->first();
        $token           = $this->stage([$purchaseRequest]);
        $this->post(route('purchaseOrders.fromRequests.store'), $this->payload($token, [
            $this->draft($source, $this->supplierId, 'draft-1', 'allocation-1'),
        ]))->assertRedirect();
        $purchaseOrder = PurchaseOrder::firstOrFail();
        $source->updateQuietly(['conversion_factor' => 0]);

        try {
            app(PurchaseOrderService::class)->onApproved($purchaseOrder);
            $this->fail('Invalid source factor must stop approval.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('items', $exception->errors());
        }
        $this->assertContains(FormStatus::DRAFT, $purchaseOrder->fresh()->status);
        $this->assertSame(0, ModelConnection::where('reference_type', PurchaseOrderItem::class)->count());
        $this->assertSame(0.0, (float) $source->fresh()->ordered_quantity);
    }

    public function test_forged_or_changed_source_rejects_all_drafts(): void {
        $first   = $this->makeRequest();
        $foreign = $this->makeRequest();
        $token   = $this->stage([$first]);
        $draft   = $this->draft($foreign->items->first(), $this->supplierId, 'draft-1', 'allocation-1');
        $this->postJson(route('purchaseOrders.fromRequests.store'), $this->payload($token, [$draft]))
            ->assertUnprocessable()->assertJsonValidationErrors('drafts.0.items.0.source_item_id');
        $this->assertSame(0, PurchaseOrder::count());

        $draft = $this->draft($first->items->first(), $this->supplierId, 'draft-1', 'allocation-1');
        $first->items->first()->update(['ordered_quantity' => 2]);
        $this->postJson(route('purchaseOrders.fromRequests.store'), $this->payload($token, [$draft]))->assertUnprocessable();
        $this->assertSame(0, PurchaseOrder::count());

        $first->items->first()->update(['ordered_quantity' => 0]);
        $first->update(['status' => [FormStatus::CLOSED]]);
        $this->postJson(route('purchaseOrders.fromRequests.store'), $this->payload($token, [$draft]))->assertUnprocessable();
        $this->assertSame(0, PurchaseOrder::count());
    }

    public function test_failure_on_second_po_rolls_back_everything(): void {
        $first  = $this->makeRequest();
        $second = $this->makeRequest();
        $token  = $this->stage([$first, $second]);
        $drafts = [
            $this->draft($first->items->first(), $this->supplierId, 'draft-1', 'allocation-1'),
            $this->draft($second->items->first(), $this->otherSupplierId, 'draft-2', 'allocation-2'),
        ];
        $this->app->instance(PurchaseOrderService::class, new class extends PurchaseOrderService
        {
            private int $calls = 0;

            public function create(array $data): Model {
                $this->calls++;
                if ($this->calls === 2) {
                    throw new \RuntimeException('Second PO failed');
                }

                return parent::create($data);
            }
        });

        $this->withoutExceptionHandling();
        $this->expectException(\RuntimeException::class);
        try {
            $this->post(route('purchaseOrders.fromRequests.store'), $this->payload($token, $drafts));
        } finally {
            $this->assertSame(0, PurchaseOrder::count());
            $this->assertSame(0, PurchaseOrderBatchSubmission::count());
        }
    }

    public function test_store_rechecks_permissions_and_source_identity(): void {
        $purchaseRequest = $this->makeRequest();
        $token           = $this->stage([$purchaseRequest]);
        $draft           = $this->draft($purchaseRequest->items->first(), $this->supplierId, 'draft-1', 'allocation-1');

        $differentUnit     = Unit::withoutEvents(fn () => Unit::create(['name' => 'Box', 'code' => fake()->unique()->bothify('BOX-####')]));
        $differentItemUnit = ItemUnit::withoutEvents(fn () => ItemUnit::create([
            'item_id'           => ItemVariant::findOrFail($purchaseRequest->items->first()->item_variant_id)->item_id,
            'unit_id'           => $differentUnit->id,
            'conversion_factor' => 10,
        ]));
        $draft['items'][0]['unit']['id'] = $differentItemUnit->id;
        $this->post(route('purchaseOrders.fromRequests.store'), $this->payload($token, [$draft]))->assertRedirect();
        $this->assertSame($differentItemUnit->id, PurchaseOrderItem::firstOrFail()->item_unit_id);

        $token                                                            = $this->stage([$purchaseRequest]);
        $draft                                                            = $this->draft($purchaseRequest->items->first(), $this->supplierId, 'draft-1', 'allocation-1');
        $permissions                                                      = session('permissions');
        $permissions[PurchaseRequest::class][0][0]['permissions']['read'] = false;
        $this->withSession(['permissions' => $permissions]);
        $this->postJson(route('purchaseOrders.fromRequests.store'), $this->payload($token, [$draft]))->assertForbidden();
        $this->assertSame(1, PurchaseOrder::count());
    }

    public function test_selected_unit_uses_server_factor_and_rejects_other_product_without_partial_drafts(): void {
        $purchaseRequest = $this->makeRequest();
        $source          = $purchaseRequest->items->first();
        $unit            = Unit::withoutEvents(fn () => Unit::create(['name' => 'Box', 'code' => fake()->unique()->bothify('BOX-####')]));
        $itemUnit        = ItemUnit::withoutEvents(fn () => ItemUnit::create([
            'item_id'           => ItemVariant::findOrFail($source->item_variant_id)->item_id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 12,
        ]));
        $token                     = $this->stage([$purchaseRequest]);
        $draft                     = $this->draft($source, $this->supplierId, 'draft-1', 'allocation-1', 2);
        $draft['items'][0]['unit'] = ['id' => $itemUnit->id, 'conversion_factor' => 999];

        $this->post(route('purchaseOrders.fromRequests.store'), $this->payload($token, [$draft]))->assertRedirect();
        $this->assertSame($itemUnit->id, PurchaseOrderItem::firstOrFail()->item_unit_id);
        $this->assertSame(12.0, (float) PurchaseOrderItem::firstOrFail()->conversion_factor);

        $otherRequest = $this->makeRequest();
        $foreignItem  = Item::factory()->create();
        $foreignUnit  = ItemUnit::withoutEvents(fn () => ItemUnit::create([
            'item_id'           => $foreignItem->id,
            'unit_id'           => $unit->id,
            'conversion_factor' => 12,
        ]));
        $token                             = $this->stage([$otherRequest]);
        $valid                             = $this->draft($otherRequest->items->first(), $this->supplierId, 'draft-2', 'allocation-2');
        $invalid                           = $this->draft($otherRequest->items->first(), $this->otherSupplierId, 'draft-3', 'allocation-3');
        $invalid['items'][0]['unit']['id'] = $foreignUnit->id;
        $this->postJson(route('purchaseOrders.fromRequests.store'), $this->payload($token, [$valid, $invalid]))
            ->assertUnprocessable()->assertJsonValidationErrors('drafts.1.items.0.unit.id');
        $this->assertSame(1, PurchaseOrder::count());
    }

    public function test_changed_source_conversion_factor_invalidates_staged_snapshot(): void {
        $purchaseRequest = $this->makeRequest();
        $source          = $purchaseRequest->items->first();
        $token           = $this->stage([$purchaseRequest]);
        DB::table('purchase_request_items')->where('id', $source->id)->update(['conversion_factor' => 2]);

        $this->postJson(route('purchaseOrders.fromRequests.store'), $this->payload($token, [
            $this->draft($source, $this->supplierId, 'draft-1', 'allocation-1'),
        ]))->assertUnprocessable()->assertJsonValidationErrors('sources');
        $this->assertSame(0, PurchaseOrder::count());
    }

    public function test_result_is_restricted_to_creator_and_active_branch(): void {
        $purchaseRequest = $this->makeRequest();
        $token           = $this->stage([$purchaseRequest]);
        $response        = $this->post(route('purchaseOrders.fromRequests.store'), $this->payload($token, [
            $this->draft($purchaseRequest->items->first(), $this->supplierId, 'draft-1', 'allocation-1'),
        ]))->assertRedirect();
        $resultUrl = $response->headers->get('Location');

        $this->actingAs(User::factory()->create());
        $this->getJson($resultUrl)->assertNotFound();
        $this->withSession(['currentBranch' => Branch::factory()->create()->id]);
        $this->getJson($resultUrl)->assertNotFound();
    }

    public function test_identical_retry_returns_same_result_and_changed_payload_is_rejected(): void {
        $purchaseRequest = $this->makeRequest();
        $token           = $this->stage([$purchaseRequest]);
        $payload         = $this->payload($token, [
            $this->draft($purchaseRequest->items->first(), $this->supplierId, 'draft-1', 'allocation-1'),
        ]);
        $first  = $this->post(route('purchaseOrders.fromRequests.store'), $payload)->assertRedirect();
        $second = $this->post(route('purchaseOrders.fromRequests.store'), $payload)->assertRedirect();
        $this->assertSame($first->headers->get('Location'), $second->headers->get('Location'));
        $this->assertSame(1, PurchaseOrder::count());

        $payload['drafts'][0]['items'][0]['quantity'] = 8;
        $this->postJson(route('purchaseOrders.fromRequests.store'), $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('idempotency_key');
        $this->assertSame(1, PurchaseOrder::count());
    }
}
