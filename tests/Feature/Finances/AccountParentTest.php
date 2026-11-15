<?php

namespace Tests\Feature\Finances;

use App\Models\Finances\Account;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Form Akun mengirim `parent_account`; controller harus menyimpannya ke kolom `parent_id` (bukan kolom yang tidak
 * ada), supaya akun baru masuk ke pohon di bawah induk yang dipilih dan tidak menjadi akun yatim.
 */
class AccountParentTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $assetRoot;
    private Account $fixedAssetGroup;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures();
        $this->assetRoot       = $this->makeGroup('1000', 'Asset', null);
        $this->fixedAssetGroup = $this->makeGroup('1100', 'Asset Tetap', $this->assetRoot);
    }

    private function makeGroup(string $number, string $name, ?Account $parent): Account {
        return Account::create([
            'account_name'   => $name,
            'account_number' => $number,
            'is_group'       => true,
            'root_type'      => 'asset',
            'report_type'    => 'balance_sheet',
            'balance_type'   => 'debit',
            'parent_id'      => $parent?->id,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionWithPermission(): array {
        return [
            'permissions' => [
                Account::class => [
                    0 => [
                        [
                            'model'        => Account::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => ['select' => true, 'read' => true, 'create' => true, 'write' => true],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function http(): static {
        return $this
            ->withSession($this->sessionWithPermission())
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(string $number, Account $parent): array {
        return [
            'account_name'   => 'Aset Tetap',
            'account_number' => $number,
            'account_type'   => 'fixed_asset',
            'balance_type'   => 'debit',
            'parent_account' => ['id' => $parent->id],
        ];
    }

    #[Test]
    public function store_saves_the_selected_parent(): void {
        $this->http()->post(route('accounts.store'), $this->payload('1110', $this->fixedAssetGroup))->assertRedirect();

        $account = Account::where('account_number', '1110')->firstOrFail();

        $this->assertSame($this->fixedAssetGroup->id, $account->parent_id);
        $this->assertSame('asset', $account->root_type);
    }

    #[Test]
    public function update_moves_the_account_to_the_new_parent(): void {
        $account = Account::create([
            'account_name'   => 'Aset Tetap',
            'account_number' => '1110',
            'is_group'       => false,
            'account_type'   => 'fixed_asset',
            'root_type'      => 'asset',
            'report_type'    => 'balance_sheet',
            'balance_type'   => 'debit',
            'parent_id'      => $this->assetRoot->id,
        ]);

        $this->http()
            ->put(route('accounts.update', $account), ['id' => $account->id, ...$this->payload('1110', $this->fixedAssetGroup)])
            ->assertSessionHasNoErrors()
            ->assertRedirect();

        $this->assertSame($this->fixedAssetGroup->id, $account->fresh()->parent_id);
    }
}
