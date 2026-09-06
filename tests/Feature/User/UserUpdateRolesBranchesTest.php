<?php

namespace Tests\Feature\User;

use App\Models\Core\Branch;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Regresi: UserController::update() harus sync roles/branches berdasar
 * PERMISSION (manage_roles/manage_branches), bukan berdasar identitas
 * (auth user == user yang diedit) — selaras fix di UserShowSelfTest.
 * Kalau tetap identity-based, admin yang (setelah fix show()) kini BISA
 * melihat & mencentang section roles/branches di profilnya sendiri akan
 * kehilangan perubahannya secara senyap saat submit (sync di-skip).
 */
class UserUpdateRolesBranchesTest extends TestCase {
    use RefreshDatabase;

    private User $authUser;
    private Role $role;
    private Branch $branch;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        $this->authUser = User::factory()->create();
        $this->role     = Role::create(['name' => 'Test Role', 'is_disabled' => false]);
        $this->branch   = Branch::factory()->create();
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionData(bool $canManageRoles, bool $canManageBranches): array {
        return [
            'permissions' => [
                User::class => [
                    0 => [
                        [
                            'model'        => User::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select'          => true,
                                'read'            => true,
                                'write'           => true,
                                'manage_roles'    => $canManageRoles,
                                'manage_branches' => $canManageBranches,
                            ],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    public function test_self_edit_with_manage_roles_permission_syncs_roles(): void {
        $response = $this
            ->withSession($this->sessionData(true, false))
            ->withCookie('lang', 'en')
            ->actingAs($this->authUser)
            ->put(route('users.update', $this->authUser), [
                'id'       => $this->authUser->id,
                'name'     => $this->authUser->name,
                'email'    => $this->authUser->email,
                'username' => $this->authUser->username ?? 'self_edit_user',
                'roles'    => [$this->role->id],
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();
        $this->assertTrue($this->authUser->fresh()->roles()->where('roles.id', $this->role->id)->exists());
    }

    public function test_self_edit_without_manage_roles_permission_does_not_sync_roles(): void {
        $this->authUser->roles()->sync([$this->role->id]);

        $response = $this
            ->withSession($this->sessionData(false, false))
            ->withCookie('lang', 'en')
            ->actingAs($this->authUser)
            ->put(route('users.update', $this->authUser), [
                'id'       => $this->authUser->id,
                'name'     => $this->authUser->name,
                'email'    => $this->authUser->email,
                'username' => $this->authUser->username ?? 'self_edit_user',
                // 'roles' sengaja tidak dikirim (nullable, rule 'min:1' menolak
                // array kosong) — payload ini mensimulasikan submit form tanpa
                // menyentuh section roles sama sekali.
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        // roles tidak boleh berubah krn user gak punya izin manage_roles.
        $this->assertTrue($this->authUser->fresh()->roles()->where('roles.id', $this->role->id)->exists());
    }

    public function test_self_edit_with_manage_branches_permission_syncs_branches(): void {
        $response = $this
            ->withSession($this->sessionData(false, true))
            ->withCookie('lang', 'en')
            ->actingAs($this->authUser)
            ->put(route('users.update', $this->authUser), [
                'id'       => $this->authUser->id,
                'name'     => $this->authUser->name,
                'email'    => $this->authUser->email,
                'username' => $this->authUser->username ?? 'self_edit_user',
                'branches' => [$this->branch->id],
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();
        $this->assertTrue($this->authUser->fresh()->branches()->where('branches.id', $this->branch->id)->exists());
    }

    public function test_other_user_edit_still_requires_manage_roles_permission(): void {
        $otherUser = User::factory()->create();
        $otherUser->roles()->sync([$this->role->id]);

        $response = $this
            ->withSession($this->sessionData(false, true))
            ->withCookie('lang', 'en')
            ->actingAs($this->authUser)
            ->put(route('users.update', $otherUser), [
                'id'    => $otherUser->id,
                'name'  => $otherUser->name,
                'email' => $otherUser->email,
                // 'roles' sengaja tidak dikirim, lihat catatan di test lain.
                'branches'          => [$this->branch->id],
                'default_branch_id' => $this->branch->id,
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        // manage_roles false -> role existing tidak tersentuh.
        $this->assertTrue($otherUser->fresh()->roles()->where('roles.id', $this->role->id)->exists());
        // manage_branches true -> branches baru ke-sync.
        $this->assertTrue($otherUser->fresh()->branches()->where('branches.id', $this->branch->id)->exists());
    }
}
