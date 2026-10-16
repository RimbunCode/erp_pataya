<?php

namespace Tests\Feature\Purchase;

use App\Enums\FormStatus;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Inventory\ItemVariant;
use App\Models\Purchase\PurchaseRequest;
use App\Models\Purchase\PurchaseRequestItem;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PurchaseRequestPoEligibilityTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            AppMiddleware::class,
            EnsureUserIsOnboarded::class,
            HandleInertiaRequests::class,
            LanguageMiddleware::class,
            QueryDetectorMiddleware::class,
        ]);

        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'is_example')) {
            Schema::table('users', fn ($table) => $table->boolean('is_example')->default(false));
        }

        PurchaseRequest::initPermissions();
        $this->actingAs(User::factory()->create());
    }

    private function makeRequest(FormStatus $status, float $quantity = 10, float $orderedQuantity = 0): PurchaseRequest {
        $purchaseRequest = PurchaseRequest::create([
            'date'   => now(),
            'code'   => 'PR-' . fake()->unique()->numerify('####'),
            'status' => [$status],
        ]);

        PurchaseRequestItem::create([
            'purchase_request_id' => $purchaseRequest->id,
            'item_variant_id'     => ItemVariant::factory()->create()->id,
            'quantity'            => $quantity,
            'ordered_quantity'    => $orderedQuantity,
        ]);

        return $purchaseRequest->fresh();
    }

    public function test_only_submitted_valid_requests_with_remaining_items_are_eligible(): void {
        $eligible = $this->makeRequest(FormStatus::TO_ORDER);
        $this->assertTrue($eligible->canCreatePo);

        foreach ([FormStatus::DRAFT, FormStatus::CANCELED, FormStatus::REJECTED, FormStatus::CLOSED, FormStatus::NEED_APPROVAL] as $status) {
            $this->assertFalse($this->makeRequest($status)->canCreatePo);
        }

        $this->assertFalse($this->makeRequest(FormStatus::TO_ORDER, orderedQuantity: 10)->canCreatePo);
    }

    public function test_row_action_metadata_is_available_when_items_and_status_are_hidden_without_per_row_queries(): void {
        $eligible   = $this->makeRequest(FormStatus::TO_ORDER);
        $ineligible = $this->makeRequest(FormStatus::TO_ORDER, orderedQuantity: 10);
        $permission = [
            'permissions' => [
                PurchaseRequest::class => [
                    0 => [[
                        'model'        => PurchaseRequest::class,
                        'level'        => 0,
                        'only_creator' => false,
                        'permissions'  => ['select' => true, 'read' => true],
                    ]],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];

        $itemQueries = [];
        DB::listen(function ($query) use (&$itemQueries): void {
            if (str_contains($query->sql, ' from "purchase_request_items" ')) {
                $itemQueries[] = $query->sql;
            }
        });

        $response = $this->withSession($permission)
            ->withUnencryptedCookie('datatable_columns_purchase_requests', json_encode(['code' => ['width' => 100]]))
            ->getJson(route('purchaseRequests.index'), ['X-Inertia' => 'true'])
            ->assertOk();

        $rows = collect($response->json('props.data.data'))->keyBy('id');
        $this->assertTrue($rows[$eligible->id]['canCreatePo']);
        $this->assertFalse($rows[$ineligible->id]['canCreatePo']);
        $this->assertLessThanOrEqual(2, count($itemQueries));
    }
}
