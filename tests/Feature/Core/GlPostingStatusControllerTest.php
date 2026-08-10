<?php

namespace Tests\Feature\Core;

use App\Enums\FormStatus;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Core\GlPostingStatus;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\User\User;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class GlPostingStatusControllerTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([
            QueryDetectorMiddleware::class,
        ]);

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, GlPostingStatus::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->user = User::factory()->create();
        Branch::create(['name' => 'Main Branch', 'code' => 'MB']);

        Auth::login($this->user);
    }

    private function sessionWithPermission(array $permissions): array {
        return [
            'permissions' => [
                GlPostingStatus::class => [
                    0 => [
                        [
                            'model'        => GlPostingStatus::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => $permissions,
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function makePurchaseReceiptId(): string {
        $id = (string) Str::ulid();
        DB::table('purchase_receipts')->insert([
            'id'         => $id,
            'date'       => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    public function test_index_returns_200_with_select_permission(): void {
        $response = $this
            ->withSession($this->sessionWithPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('gl-posting-statuses.index'));

        $response->assertOk();
    }

    public function test_index_returns_403_without_select_permission(): void {
        $response = $this
            ->withSession($this->sessionWithPermission(['select' => false, 'read' => false]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('gl-posting-statuses.index'));

        $response->assertForbidden();
    }

    public function test_retry_resets_failed_status_and_redispatches_event(): void {
        Event::fake([PurchaseReceiptGeneralLedgerPostingRequested::class]);

        $purchaseReceiptId = $this->makePurchaseReceiptId();
        $glPostingStatus   = GlPostingStatus::create([
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $purchaseReceiptId,
            'status'             => FormStatus::FAILED,
            'retry_count'        => 3,
            'last_error'         => 'Account not found',
        ]);

        $response = $this
            ->withSession($this->sessionWithPermission(['select' => true, 'read' => true, 'write' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->post(route('gl-posting-statuses.retry', $glPostingStatus));

        $response->assertRedirect();

        $glPostingStatus->refresh();
        $this->assertEquals(FormStatus::PENDING, $glPostingStatus->status);
        $this->assertEquals(0, $glPostingStatus->retry_count);
        $this->assertNull($glPostingStatus->last_error);

        Event::assertDispatched(PurchaseReceiptGeneralLedgerPostingRequested::class);
    }

    public function test_retry_rejects_pending_status(): void {
        $purchaseReceiptId = $this->makePurchaseReceiptId();
        $glPostingStatus   = GlPostingStatus::create([
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $purchaseReceiptId,
            'status'             => FormStatus::PENDING,
        ]);

        $response = $this
            ->withSession($this->sessionWithPermission(['select' => true, 'read' => true, 'write' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->post(route('gl-posting-statuses.retry', $glPostingStatus));

        $response->assertStatus(422);
    }

    public function test_retry_returns_403_without_write_permission(): void {
        $purchaseReceiptId = $this->makePurchaseReceiptId();
        $glPostingStatus   = GlPostingStatus::create([
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $purchaseReceiptId,
            'status'             => FormStatus::FAILED,
        ]);

        $response = $this
            ->withSession($this->sessionWithPermission(['select' => true, 'read' => true, 'write' => false]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->post(route('gl-posting-statuses.retry', $glPostingStatus));

        $response->assertForbidden();
    }
}
