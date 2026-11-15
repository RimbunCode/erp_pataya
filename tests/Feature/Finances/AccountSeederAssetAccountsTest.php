<?php

namespace Tests\Feature\Finances;

use App\Models\Core\Currency;
use App\Models\Finances\Account;
use Database\Seeders\AccountSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Bagan akun bawaan harus punya akun daun (bukan grup) untuk peran aset tetap, supaya pemetaan
 * AssetCategoryAccount dan profil posting tidak berakhir pada akun grup yang ditolak jurnal.
 */
class AccountSeederAssetAccountsTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        Account::initPermissions();
        Currency::firstOrCreate(['code' => 'IDR'], ['name' => 'Indonesian rupiah']);
    }

    #[Test]
    public function seeder_provides_leaf_accounts_for_fixed_asset_roles(): void {
        $this->seed(AccountSeeder::class);

        $expected = [
            '1110' => ['fixed_asset', 'asset'],
            '1120' => ['accumulated_depreciation', 'asset'],
            '4310' => ['income_account', 'income'],
            '5210' => ['depreciation', 'expense'],
            '5310' => ['expense_account', 'expense'],
        ];

        foreach ($expected as $number => [$type, $root]) {
            $account = Account::where('account_number', $number)->first();

            $this->assertNotNull($account, "Akun {$number} tidak ada");
            $this->assertFalse((bool) $account->is_group, "Akun {$number} harus akun daun");
            $this->assertSame($type, $account->account_type?->value ?? $account->account_type);
            $this->assertSame($root, $account->root_type?->value ?? $account->root_type);
        }
    }
}
