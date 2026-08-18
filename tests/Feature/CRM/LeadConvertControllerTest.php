<?php

namespace Tests\Feature\CRM;

use App\Events\CRM\LeadConvertedToCustomer;
use App\Models\CRM\Lead;
use App\Models\Sales\Customer;
use App\Models\User\User;
use App\Services\Sales\CustomerService;
use BeyondCode\QueryDetector\QueryDetectorMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class LeadConvertControllerTest extends TestCase {
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

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->user = User::factory()->create();
        Auth::login($this->user);
    }

    private function sessionWithPermission(array $permissions): array {
        return [
            'permissions' => [
                Lead::class => [
                    0 => [
                        [
                            'model'        => Lead::class,
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

    private function makeLead(): Lead {
        return Lead::create([
            'company_name' => 'Acme Corp',
            'email'        => 'acme@example.test',
            'phone'        => '08123456789',
            'street'       => 'Jl. Contoh No. 1',
            'city'         => 'Jakarta',
            'province'     => 'DKI Jakarta',
            'zip_code'     => '12345',
        ]);
    }

    public function test_convert_creates_customer_and_response_id_matches_db(): void {
        $existingCount = Customer::count();
        if ($existingCount > 0) {
            throw new \RuntimeException("DEBUG: {$existingCount} customer(s) exist BEFORE this test runs anything: " . Customer::pluck('name')->implode(', '));
        }

        $lead = $this->makeLead();

        $response = $this
            ->withSession($this->sessionWithPermission(['write' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->put(route('leads.convert', $lead));

        $response->assertRedirect();
        $responseId = session('id');

        $this->assertNotNull($responseId);
        $customer = Customer::find($responseId);
        $this->assertNotNull($customer);
        $this->assertEquals('Acme Corp', $customer->name);

        $lead->refresh();
        $this->assertEquals($responseId, $lead->converted_customer_id);
        $this->assertEquals('converted', $lead->status);
    }

    public function test_convert_is_idempotent_on_second_call(): void {
        $lead = $this->makeLead();

        // Panggilan pertama: event/listener asli jalan (TANPA Event::fake()),
        // supaya Customer benar-benar dibuat dan Lead ter-update.
        $this
            ->withSession($this->sessionWithPermission(['write' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->put(route('leads.convert', $lead));

        $lead->refresh();
        $firstCustomerId = $lead->converted_customer_id;
        $this->assertNotNull($firstCustomerId);
        $this->assertSame(1, Customer::count());

        // Panggilan kedua: fake event SEKARANG (setelah Lead sudah
        // converted_customer_id terisi) — assert event TIDAK dipatch sama
        // sekali, karena guard idempotent di Controller early-return SEBELUM
        // dispatch dipanggil.
        Event::fake([LeadConvertedToCustomer::class]);

        $response = $this
            ->withSession($this->sessionWithPermission(['write' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->put(route('leads.convert', $lead));

        $response->assertRedirect();
        $this->assertEquals($firstCustomerId, session('id'));

        Event::assertNotDispatched(LeadConvertedToCustomer::class);
        $this->assertSame(1, Customer::count());
    }

    public function test_convert_rolls_back_when_customer_create_fails(): void {
        // Paksa kegagalan DI DALAM listener (bukan constraint DB Lead) —
        // mock CustomerService::storeBranches() supaya throw setelah
        // Customer::create() sukses. Transaksi Controller yang sama harus
        // rollback SEMUANYA, termasuk Customer yang sudah sempat dibuat.
        $this->app->bind(CustomerService::class, function () {
            $mock = Mockery::mock(CustomerService::class);
            $mock->shouldReceive('storeBranches')->andThrow(new \RuntimeException('forced failure'));

            return $mock;
        });

        $lead = $this->makeLead();

        try {
            $this
                ->withSession($this->sessionWithPermission(['write' => true]))
                ->withCookie('lang', 'en')
                ->actingAs($this->user)
                ->put(route('leads.convert', $lead));
        } catch (\Throwable) {
            // Exception diharapkan — yang diverifikasi adalah state DB
            // setelah rollback, bukan response HTTP-nya.
            //
            // LeadController::convert() tidak membungkus DB::beginTransaction()
            // dengan try/catch (konsisten pola Controller lain di proyek ini,
            // mis. PurchaseReceiptController) — di request produksi sungguhan,
            // koneksi DB direset di akhir siklus request Laravel. Dalam test
            // (satu koneksi persisten across test method), transaksi yang
            // terbuka saat exception HARUS ditutup manual di sini supaya
            // tidak bocor ke test berikutnya dalam file yang sama.
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
        }

        $lead->refresh();
        $this->assertNull($lead->converted_customer_id);
        $this->assertNotEquals('converted', $lead->status);
        $this->assertSame(0, Customer::count());
    }
}
