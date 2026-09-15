<?php

namespace Tests\Feature\Purchase;

use App\Models\Core\Country;
use App\Models\Core\FormatingSeries;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\Supplier;
use App\Models\User\User;
use Database\Factories\Finances\PaymentMethodFactory;
use Database\Factories\Purchase\PurchaseOrderFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Regresi: PurchaseOrder::loadRelationsOnShow() sebelumnya TIDAK memuat
 * relasi `paymentSchedules`, padahal PurchaseOrderService::update() (lihat
 * app/Services/Purchase/PurchaseOrderService.php sekitar baris 205-232)
 * menyimpannya ke DB lewat $purchaseOrder->paymentSchedules()->create()/
 * update(). Akibatnya payment schedule PO yang sudah tersimpan hilang dari
 * tampilan begitu halaman show/update di-reload -- padahal datanya utuh di
 * DB. Bandingkan App\Models\Sales\SalesOrder yang loadRelationsOnShow()-nya
 * sudah memuat 'paymentSchedules' & 'paymentSchedules.paymentMethod'.
 */
class PurchaseOrderShowPaymentSchedulesTest extends TestCase {
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
     * null-safe (bug pre-existing, di luar scope test ini) -- factory
     * default tidak set country_id, sehingga serialisasi Supplier crash.
     * Lengkapi country_id di sini agar test fokus pada payment_schedules.
     */
    private function createPurchaseOrder(): PurchaseOrder {
        $purchaseOrder = PurchaseOrderFactory::new()->create();
        $country       = Country::factory()->create();
        $purchaseOrder->supplier()->update(['country_id' => $country->code]);

        return $purchaseOrder;
    }

    /**
     * Bug pre-existing tidak berhubungan dengan spec ini: App\Models\Finances\Account
     * pakai trait TreeView yang di event `creating` SELALU menyetel atribut
     * lft/rgt/depth, padahal migration create_accounts_table TIDAK PERNAH
     * menambahkan kolom itu ke tabel `accounts` -- insert Eloquent apa pun ke
     * Account akan gagal ("table accounts has no column named lft").
     * PaymentMethodFactory::resolveAccountId() jatuh ke fallback itu kalau
     * tidak ada Account non-group yang sudah ada. Sisipkan baris Account
     * lewat DB::table() langsung (lewati event model) supaya factory
     * menemukan account tanpa memicu bug tersebut -- di luar scope fix ini.
     */
    private function seedNonGroupAccount(): void {
        DB::table('accounts')->insert([
            'id'             => (string) Str::ulid(),
            'account_name'   => 'Kas Test',
            'account_number' => '1000',
            'is_group'       => false,
            'root_type'      => 'asset',
            'report_type'    => 'balance_sheet',
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);
    }

    public function test_show_payload_contains_payment_schedules_with_payment_method(): void {
        $purchaseOrder = $this->createPurchaseOrder();
        $this->seedNonGroupAccount();
        $paymentMethod = PaymentMethodFactory::new()->create();

        // Meniru persis apa yang dilakukan PurchaseOrderService::update()/
        // create() lewat relasi paymentSchedules() -- bukan model manual.
        $paymentSchedule = $purchaseOrder->paymentSchedules()->create([
            'invoice_portion'   => 100,
            'payment_amount'    => 500000,
            'due_date'          => now()->addDays(30),
            'for_internal'      => true,
            'payment_method_id' => $paymentMethod->id,
        ]);

        $response = $this->authenticatedRequest()
            ->get(route('purchaseOrders.show', $purchaseOrder));

        $response->assertStatus(200);

        $props             = $response->viewData('page')['props'] ?? $response->original->getData()['page']['props'] ?? null;
        $purchaseOrderProp = $props['purchaseOrder'] ?? null;

        $this->assertNotNull($purchaseOrderProp, 'Prop purchaseOrder tidak ditemukan di response Inertia.');
        $this->assertArrayHasKey('payment_schedules', $purchaseOrderProp);
        $this->assertCount(1, $purchaseOrderProp['payment_schedules']);

        $schedulePayload = $purchaseOrderProp['payment_schedules'][0];
        $this->assertSame($paymentSchedule->id, $schedulePayload['id']);

        // paymentSchedules.paymentMethod harus ikut ter-eager-load (nested),
        // bukan cuma payment_method_id mentah.
        $this->assertArrayHasKey('payment_method', $schedulePayload);
        $this->assertNotNull($schedulePayload['payment_method']);
        $this->assertSame($paymentMethod->id, $schedulePayload['payment_method']['id']);
    }
}
