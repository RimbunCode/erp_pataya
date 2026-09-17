<?php

namespace Tests\Feature\User;

use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Regresi untuk bug: halaman show user tidak menampilkan daftar roles/branches
 * saat user melihat profil dirinya sendiri (mis. lewat "Manage Account" di
 * navbar, lihat UserInfo.jsx, yang selalu mengarah ke id auth user sendiri).
 *
 * Sebelum fix: UserController::show() gating roles/branches berdasar IDENTITAS
 * (auth user == user yang dilihat) tanpa cek permission sama sekali — siapa pun
 * yang membuka profil sendiri kehilangan data roles/branches, termasuk admin
 * yang punya permission manage_roles/manage_branches. Fix: gating dipindah ke
 * permission (manage_roles/manage_branches), selaras dengan Form.jsx yang sudah
 * memakai canUser("manage_roles")/canUser("manage_branches") untuk menampilkan
 * section-nya.
 */
class UserShowSelfTest extends TestCase {
    use RefreshDatabase;

    private User $authUser;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        $this->authUser = User::factory()->create();
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

    /**
     * @return array<string, mixed>
     */
    private function getPage(bool $canManageRoles, bool $canManageBranches): array {
        $response = $this
            ->withSession($this->sessionData($canManageRoles, $canManageBranches))
            ->withCookie('lang', 'en')
            ->actingAs($this->authUser)
            ->get(route('users.show', $this->authUser));

        $response->assertOk();

        preg_match('#<script[^>]*type="application/json">(.*?)</script>#s', $response->getContent(), $matches);

        return json_decode($matches[1], true);
    }

    public function test_self_view_with_manage_roles_permission_gets_roles_data(): void {
        $page = $this->getPage(true, false);

        $this->assertContains('roles', $page['deferredProps']['default'] ?? []);
        $this->assertSame([], $page['props']['user']['roles']);
    }

    public function test_self_view_without_manage_roles_permission_gets_no_roles_data(): void {
        $page = $this->getPage(false, false);

        $this->assertArrayNotHasKey('roles', $page['props']);
        $this->assertArrayNotHasKey('roles', $page['props']['user']);
    }

    public function test_self_view_with_manage_branches_permission_gets_branches_data(): void {
        $page = $this->getPage(false, true);

        $this->assertContains('branches', $page['deferredProps']['default'] ?? []);
        $this->assertSame([], $page['props']['user']['branches']);
    }

    public function test_self_view_without_manage_branches_permission_gets_no_branches_data(): void {
        $page = $this->getPage(false, false);

        $this->assertArrayNotHasKey('branches', $page['props']);
        $this->assertArrayNotHasKey('branches', $page['props']['user']);
    }
}
