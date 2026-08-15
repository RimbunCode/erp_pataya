<?php

namespace Tests\Feature\User;

use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\User\Role;
use App\Models\User\User;
use App\Notifications\UserInvitedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserInviteTest extends TestCase {
    use RefreshDatabase;

    private User $authUser;

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

        $this->authUser = User::factory()->create();

        $this->sessionData = [
            'permissions' => [
                User::class => [
                    0 => [
                        [
                            'model'        => User::class,
                            'level'        => 0,
                            'only_creator' => false,
                            'permissions'  => [
                                'select' => true,
                                'read'   => true,
                                'write'  => true,
                                'create' => true,
                                'delete' => true,
                            ],
                        ],
                    ],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ];
    }

    private function postInvite(array $overrides = []) {
        return $this
            ->withSession($this->sessionData)
            ->withCookie('lang', 'en')
            ->actingAs($this->authUser)
            ->post(route('users.store'), array_merge([
                'name'  => 'Invited User',
                'email' => 'invited@example.com',
            ], $overrides));
    }

    public function test_invite_creates_user_with_invited_status_and_null_credentials(): void {
        Notification::fake();

        $response = $this->postInvite();

        $response->assertRedirect(route('users.index'));
        $user = User::where('email', 'invited@example.com')->firstOrFail();
        $this->assertSame(FormStatus::INVITED, $user->status);
        $this->assertNull($user->password);
        $this->assertNull($user->username);
        Notification::assertSentTo($user, UserInvitedNotification::class);
    }

    public function test_invite_ignores_fields_outside_whitelist(): void {
        Notification::fake();

        $this->postInvite([
            'username' => 'shouldnotbesaved',
            'password' => 'secretpassword',
            'gender'   => 'male',
            'phone'    => '08123456789',
        ]);

        $user = User::where('email', 'invited@example.com')->firstOrFail();
        $this->assertNull($user->username);
        $this->assertNull($user->password);
        $this->assertNull($user->gender);
        $this->assertNull($user->phone);
    }

    public function test_invite_syncs_roles_and_branches(): void {
        Notification::fake();

        $role   = Role::create(['name' => 'Test Role']);
        $branch = Branch::create(['name' => 'Test Branch']);

        $this->postInvite([
            'roles'             => [$role->id],
            'branches'          => [$branch->id],
            'default_branch_id' => $branch->id,
        ]);

        $user = User::where('email', 'invited@example.com')->firstOrFail();
        $this->assertTrue($user->roles()->where('roles.id', $role->id)->exists());
        $this->assertTrue($user->branches()->where('branches.id', $branch->id)->exists());
        $this->assertSame($branch->id, $user->default_branch_id);
    }

    public function test_multiple_invited_users_without_username_do_not_violate_unique_constraint(): void {
        Notification::fake();

        $this->postInvite(['email' => 'invited1@example.com']);
        $response = $this->postInvite(['email' => 'invited2@example.com']);

        $response->assertRedirect(route('users.index'));
        $this->assertSame(2, User::whereIn('email', ['invited1@example.com', 'invited2@example.com'])->whereNull('username')->count());
    }

    public function test_invite_rejects_duplicate_email_of_active_user(): void {
        Notification::fake();

        $existing = User::factory()->create(['email' => 'invited@example.com']);

        $response = $this->postInvite();

        $response->assertSessionHasErrors('email');
        $this->assertSame(1, User::where('email', 'invited@example.com')->count());
        $this->assertSame($existing->id, User::where('email', 'invited@example.com')->firstOrFail()->id);
    }

    public function test_invite_allows_email_previously_used_by_soft_deleted_user(): void {
        Notification::fake();

        $deleted = User::factory()->create(['email' => 'invited@example.com']);
        $deleted->delete();

        $response = $this->postInvite();

        $response->assertRedirect(route('users.index'));
        $this->assertSame(2, User::withTrashed()->where('email', 'invited@example.com')->count());
    }

    public function test_invite_rollback_when_role_sync_fails(): void {
        Notification::fake();

        $countBefore = User::count();

        $response = $this->postInvite([
            'roles' => ['non-existent-role-id'],
        ]);

        $response->assertSessionHasErrors('roles.0');
        $this->assertSame($countBefore, User::count());
    }
}
