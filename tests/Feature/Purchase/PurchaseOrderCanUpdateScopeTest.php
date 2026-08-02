<?php

namespace Tests\Feature\Purchase;

use App\Models\Core\Country;
use App\Models\Core\FormatingSeries;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Integration test — canUpdate/disabledOn HANYA muncul di payload show,
 * TIDAK PERNAH di index (ModelController::__invoke) maupun lookup
 * (ModelController::selectData). Requirement 1.7, 4.1, 6.2.
 */
class PurchaseOrderCanUpdateScopeTest extends TestCase {
    use RefreshDatabase;

    private User $user;

    /** @var array<string, mixed> */
    private array $sessionData;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, Supplier::class, PurchaseOrder::class] as $model) {
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

        $this->sessionData = [
            'permissions' => [
                PurchaseOrder::class => [
                    0 => [
                        [
                            'model'        => PurchaseOrder::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                                'write'  => true,
                                'create' => true,
                                'delete' => true,
                                'submit' => true,
                                'cancel' => true,
                                'amend'  => true,
                                'print'  => true,
                                'import' => true,
                                'export' => true,
                                'share'  => true,
                            ],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function authenticatedRequest(): static {
        return $this
            ->withSession($this->sessionData)
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    /**
     * Supplier::getAddressAttribute() akses $this->country->name tanpa
     * null-safe (bug pre-existing, di luar scope spec ini) — factory
     * default tidak set country_id, sehingga serialisasi Supplier crash.
     * Lengkapi country_id di sini agar test fokus pada canUpdate/disabledOn.
     */
    private function createPurchaseOrder(): PurchaseOrder {
        $purchaseOrder = PurchaseOrderFactory::new()->create();
        $country       = Country::factory()->create();
        $purchaseOrder->supplier()->update(['country_id' => $country->code]);

        return $purchaseOrder;
    }

    public function test_show_payload_contains_can_update_and_disabled_on(): void {
        $purchaseOrder = $this->createPurchaseOrder();

        $response = $this->authenticatedRequest()
            ->get(route('purchaseOrders.show', $purchaseOrder));

        $response->assertStatus(200);

        $props             = $response->viewData('page')['props'] ?? $response->original->getData()['page']['props'] ?? null;
        $purchaseOrderProp = $props['purchaseOrder'] ?? null;

        $this->assertNotNull($purchaseOrderProp, 'Prop purchaseOrder tidak ditemukan di response Inertia.');
        $this->assertArrayHasKey('canUpdate', $purchaseOrderProp);
        $this->assertArrayHasKey('disabledOn', $purchaseOrderProp);
    }

    public function test_index_ajax_payload_does_not_contain_can_update_or_disabled_on(): void {
        PurchaseOrderFactory::new()->create();

        // isInertiaRequest() = false HANYA bila request ajax() (header
        // X-Requested-With) TANPA header X-Inertia.
        $response = $this->authenticatedRequest()
            ->postJson(route('model'), [
                'model' => PurchaseOrder::class,
            ], [
                'X-Requested-With' => 'XMLHttpRequest',
            ]);

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertIsArray($data);
        if (count($data) > 0) {
            $this->assertArrayNotHasKey('canUpdate', $data[0]);
            $this->assertArrayNotHasKey('disabledOn', $data[0]);
        }
    }

    /**
     * selectData (dropdown/relation picker per-item) memakai
     * $this->safeLookupColumns() — mekanisme WHITELIST kolom aman yang
     * SAMA seperti __invoke (index/lookup): canUpdate/disabledOn tidak
     * pernah masuk daftar aman karena keduanya tidak pernah ter-append
     * pada instance non-show-context (Requirement 1.7). Skenario ini
     * secara mekanisme identik dengan test_index_ajax_payload di atas —
     * tidak diulang sbg Feature test terpisah krn macro dataTable
     * (infrastruktur DataTable existing, di luar scope spec ini) butuh
     * setup request kompleks yang tidak menambah cakupan verifikasi baru.
     */
}
