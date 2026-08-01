<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\StockEntry;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class GeneralLedgerControllerTest extends TestCase {
    use RefreshDatabase;

    private User $user;
    private Branch $branch;
    private Account $account;
    private Account $againstAccount;
    private GeneralLedger $generalLedger;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        foreach ([User::class, FormatingSeries::class, Account::class, StockEntry::class, GeneralLedger::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone',
            'value'      => json_encode('UTC'),
            'is_example' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->user   = User::factory()->create();
        $this->branch = Branch::create(['name' => 'Main Branch', 'code' => 'MB']);

        $this->account = Account::create([
            'account_name'   => 'Cash',
            'account_number' => '1101',
            'root_type'      => 'asset',
            'report_type'    => 'balance_sheet',
        ]);

        $this->againstAccount = Account::create([
            'account_name'   => 'Sales',
            'account_number' => '4101',
            'root_type'      => 'income',
            'report_type'    => 'profit_and_loss',
        ]);

        Auth::login($this->user);
        $stockEntry = StockEntry::create([
            'code'      => 'SE-DRAFT-1',
            'date'      => now(),
            'type'      => 'item_issue',
            'status'    => [FormStatus::DRAFT],
            'branch_id' => $this->branch->id,
        ]);

        $this->generalLedger = GeneralLedger::create([
            'referenceable_type' => StockEntry::class,
            'referenceable_id'   => $stockEntry->id,
            'account_id'         => $this->account->id,
            'against_account_id' => $this->againstAccount->id,
            'branch_id'          => $this->branch->id,
            'debit'              => 1000,
            'credit'             => 0,
        ]);
    }

    private function sessionWithPermission(array $permissions): array {
        return [
            'permissions' => [
                GeneralLedger::class => [
                    0 => [
                        [
                            'model'        => GeneralLedger::class,
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

    public function test_show_returns_403_without_read_permission(): void {
        $response = $this
            ->withSession($this->sessionWithPermission(['select' => false, 'read' => false]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('generalLedgers.show', $this->generalLedger));

        $response->assertForbidden();
    }

    public function test_show_returns_200_with_read_permission_and_loads_relations(): void {
        $response = $this
            ->withSession($this->sessionWithPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('generalLedgers.show', $this->generalLedger));

        $response->assertOk();
        $response->assertInertia(
            fn ($page) => $page
                ->component('Finances/GeneralLedgers/Show')
                ->where('generalLedger.id', $this->generalLedger->id)
                ->has('generalLedger.account')
                ->has('generalLedger.against_account')
                ->has('generalLedger.branch'),
        );
    }

    public function test_index_still_returns_200(): void {
        $response = $this
            ->withSession($this->sessionWithPermission(['select' => true, 'read' => true]))
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->get(route('generalLedgers.index'));

        $response->assertOk();
    }
}
