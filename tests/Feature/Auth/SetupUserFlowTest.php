<?php

namespace Tests\Feature\Auth;

use App\FormStatus;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class SetupUserFlowTest extends TestCase {
    public function test_setup_update_accepts_minimal_payload_without_optional_profile_fields(): void {
        $user = User::factory()->create([
            'status' => FormStatus::PRE_REGISTERED,
        ]);

        $response = $this->actingAs($user)
            ->from(route('setup.show'))
            ->put(route('setup.update'), [
                'name'     => 'Updated Name',
                'username' => 'updated.user',
                'email'    => 'updated@example.com',
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect(route('setup.show'));

        $user->refresh();
        $this->assertSame('Updated Name', $user->name);
        $this->assertSame('updated.user', $user->username);
        $this->assertSame('updated@example.com', $user->email);
    }

    public function test_setup_requires_new_password_when_user_has_no_password(): void {
        $user = User::factory()->create([
            'password' => null,
            'status'   => FormStatus::PRE_REGISTERED,
        ]);

        $response = $this->actingAs($user)
            ->from(route('setup.show'))
            ->put(route('setup.update'), [
                'name'     => 'No Password User',
                'username' => 'no.password',
                'email'    => 'nopassword@example.com',
            ]);

        $response->assertSessionHasErrors([
            'password',
        ]);
    }

    public function test_setup_can_attach_instructor_role_and_keeps_student_role(): void {
        $user = User::factory()->create([
            'status' => FormStatus::PRE_REGISTERED,
        ]);
        Role::query()->create([
            'name'        => 'instructor',
            'description' => 'Instructor role',
            'is_disabled' => false,
        ]);

        $response = $this->actingAs($user)
            ->from(route('setup.show'))
            ->put(route('setup.update'), [
                'name'             => $user->name,
                'username'         => $user->username,
                'email'            => $user->email,
                'wants_instructor' => true,
            ]);

        $response->assertSessionHasNoErrors();

        $roleNames = $user->fresh('roles')->roles->pluck('name')->all();
        $this->assertContains('student', $roleNames);
        $this->assertContains('instructor', $roleNames);
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => $this->requiredMigrationPaths(),
            '--force'    => true,
        ]);
    }

    /**
     * @return array<int, string>
     */
    private function requiredMigrationPaths(): array {
        return [
            'database/migrations/0001_01_01_000000_create_users_table.php',
            'database/migrations/2025_01_30_140453_create_logs_table.php',
            'database/migrations/2025_01_31_135456_create_roles_table.php',
            'database/migrations/2025_01_31_152926_create_user_role_table.php',
            'database/migrations/2025_02_20_172535_create_branches_table.php',
            'database/migrations/2025_03_04_155847_create_user_branch_table.php',
            'database/migrations/2025_03_04_160322_add_default_branch_to_users_table.php',
        ];
    }
}
