<?php

namespace Tests\Feature\Finances\Ledger;

use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\Journal;
use App\Models\Finances\JournalVoucher;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use Database\Seeders\AdministratorSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Q-P1-15 (2026-11-12): pembuatan tahun fiskal hanya untuk profil `full`; Finance Officer (profil
 * `operator`) tidak mendapat `create` pada FiscalYear/FiscalPeriod, tetapi tetap memperoleh izin operator lain.
 */
class FinanceOfficerFiscalPermissionTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([FiscalYear::class, FiscalPeriod::class, JournalVoucher::class]);
        $this->branch->forceFill(['is_main_branch' => true])->save();

        $this->seed(AdministratorSeeder::class);
    }

    /**
     * @return array<string, bool>
     */
    private function grantFor(string $roleName, string $model): array {
        $role       = Role::where('name', $roleName)->firstOrFail();
        $permission = Permission::where('model', $model)->firstOrFail();

        return RolePermission::where('role_id', $role->id)->where('permission_id', $permission->id)->firstOrFail()->permissions;
    }

    public function test_finance_officer_cannot_create_fiscal_years_or_periods(): void {
        foreach ([FiscalYear::class, FiscalPeriod::class] as $model) {
            $grant = $this->grantFor('Finance Officer', $model);

            $this->assertFalse($grant['create'] ?? false, "Finance Officer tidak boleh create pada {$model}.");
            $this->assertTrue($grant['select'] && $grant['read'], "Finance Officer tetap boleh melihat {$model}.");
            $this->assertFalse($grant['close_period'] ?? false);
            $this->assertFalse($grant['reopen_period'] ?? false);
        }
    }

    public function test_finance_officer_keeps_operator_profile_on_other_finance_models(): void {
        $voucher = $this->grantFor('Finance Officer', JournalVoucher::class);
        $journal = $this->grantFor('Finance Officer', Journal::class);

        $this->assertTrue($voucher['create']);
        $this->assertTrue($voucher['submit']);
        $this->assertTrue($journal['select'] && $journal['read']);
        $this->assertFalse($journal['reverse'] ?? false);
    }

    public function test_full_profile_role_can_still_create_fiscal_years(): void {
        $grant = $this->grantFor('System Manager', FiscalYear::class);

        $this->assertTrue($grant['create']);
        $this->assertTrue($grant['close_period']);
    }

    public function test_reseeding_is_idempotent(): void {
        $this->seed(AdministratorSeeder::class);

        $this->assertFalse($this->grantFor('Finance Officer', FiscalYear::class)['create'] ?? false);
    }
}
