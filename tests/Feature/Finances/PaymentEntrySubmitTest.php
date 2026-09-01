<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\SalesInvoice;
use App\Models\Sales\Customer;
use App\Models\User\User;
use App\Services\Finances\PaymentEntryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PaymentEntrySubmitTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // initPermissions() menambah kolom runtime (is_example, status, code, dst)
        // yang di produksi dibuat oleh PermissionSeeder, bukan migration. Juga
        // otomatis membuat row formating_series untuk model terkait.
        foreach ([User::class, FormatingSeries::class, Branch::class, SalesInvoice::class, PaymentSchedule::class, PaymentEntry::class, GeneralLedger::class] as $model) {
            $model::initPermissions();
        }

        // FormatingSeries::generate() butuh preference timezone.
        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeUser(): User {
        $id = (string) Str::ulid();
        DB::table('users')->insert([
            'id'         => $id,
            'name'       => 'Tester',
            'email'      => $id . '@test.com',
            'password'   => null,
            'status'     => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::find($id);
    }

    private function makeAccountId(string $name, string $rootType, string $accountType): string {
        $id = (string) Str::ulid();
        DB::table('accounts')->insert([
            'id'             => $id,
            'account_name'   => $name,
            'account_number' => (string) random_int(1000, 9999),
            'root_type'      => $rootType,
            'account_type'   => $accountType,
            'report_type'    => 'balance_sheet',
            'balance_amount' => 0,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        return $id;
    }

    /**
     * Regresi untuk bug: PaymentEntryService::onApproved() memanggil
     * generalLedgerEntries()->create() tanpa 'transaction_date' padahal kolom
     * itu NOT NULL tanpa default (migration 2026_08_09_084201) -> QueryException
     * 1364 saat submit / approve payment entry.
     */
    public function test_on_approved_creates_general_ledger_with_transaction_date(): void {
        Auth::login($this->makeUser());

        $branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB']);

        $paidFromId = $this->makeAccountId('Kas', 'asset', 'cash');
        $paidToId   = $this->makeAccountId('Piutang Dagang', 'asset', 'receivable');

        $invoice = SalesInvoice::create([
            'date'        => now()->subDay(),
            'amount'      => 1_000_000,
            'paid_amount' => 0,
            'status'      => [FormStatus::UNPAID],
            'branch_id'   => $branch->id,
            'code'        => 'SI-PE-1',
        ]);

        PaymentSchedule::create([
            'payment_scheduleable_type' => SalesInvoice::class,
            'payment_scheduleable_id'   => $invoice->id,
            'invoice_portion'           => 100,
            'payment_amount'            => 1_000_000,
            'paid_amount'               => 0,
            'for_internal'              => false,
            'due_date'                  => now()->addDays(7),
        ]);

        $paymentDate = now()->subDay()->startOfDay();

        $customerId = (string) Str::ulid();
        DB::table('customers')->insert([
            'id'         => $customerId,
            'name'       => 'Pelanggan Uji',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $paymentEntry = PaymentEntry::create([
            'date'                 => $paymentDate,
            'payment_type'         => 'receive',
            'partyable_type'       => Customer::class,
            'partyable_id'         => $customerId,
            'paymentable_type'     => SalesInvoice::class,
            'paymentable_id'       => $invoice->id,
            'paid_amount'          => 1_000_000,
            'base_paid_amount'     => 1_000_000,
            'exchange_rate'        => 1,
            'account_paid_to_id'   => $paidToId,
            'account_paid_from_id' => $paidFromId,
            'status'               => [FormStatus::DRAFT],
            'branch_id'            => $branch->id,
            'code'                 => 'PE-1',
        ]);

        (new PaymentEntryService)->onApproved($paymentEntry->fresh());

        $entries = GeneralLedger::where('referenceable_type', PaymentEntry::class)
            ->where('referenceable_id', $paymentEntry->id)
            ->get();

        $this->assertCount(2, $entries);
        $entries->each(function (GeneralLedger $gl) use ($paymentDate): void {
            $this->assertNotNull(
                $gl->transaction_date,
                'GeneralLedger.transaction_date wajib terisi saat onApproved.',
            );
            $this->assertSame(
                $paymentDate->toDateString(),
                $gl->transaction_date->toDateString(),
                'transaction_date GL harus mengikuti tanggal PaymentEntry.',
            );
        });
    }
}
