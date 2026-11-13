<?php

namespace Tests\Feature\Finances\Posting;

use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Models\User\Permission;
use App\Models\User\Role;
use App\Models\User\RolePermission;
use Database\Seeders\AdministratorSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Q-P2-15 (2026-11-13): Finance Officer (profil `operator`) hanya baca pada Posting Profile
 * (preseden Q-P1-15); peran `full` tetap dapat menulis dan mengaktifkan.
 */
class FinanceOfficerPostingPermissionTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PostingParityLog::class]);
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

    public function test_finance_officer_is_read_only_on_posting_profiles(): void {
        $grant = $this->grantFor('Finance Officer', PostingProfile::class);

        $this->assertTrue($grant['select'] && $grant['read']);
        $this->assertFalse($grant['write'] ?? false);
        $this->assertFalse($grant['activate'] ?? false);
    }

    public function test_finance_officer_cannot_switch_posting_mode_but_can_read_parity_logs(): void {
        $grant = $this->grantFor('Finance Officer', PostingParityLog::class);

        $this->assertTrue($grant['select'] && $grant['read']);
        $this->assertFalse($grant['switch_posting_mode'] ?? false);
    }

    public function test_full_profile_role_can_still_write_and_activate(): void {
        $grant = $this->grantFor('System Manager', PostingProfile::class);

        $this->assertTrue($grant['write']);
        $this->assertTrue($grant['activate']);
        $this->assertTrue($this->grantFor('System Manager', PostingParityLog::class)['switch_posting_mode']);
    }

    public function test_reseeding_is_idempotent(): void {
        $this->seed(AdministratorSeeder::class);

        $grant = $this->grantFor('Finance Officer', PostingProfile::class);
        $this->assertFalse($grant['write'] ?? false);
        $this->assertTrue($grant['select']);
    }
}
