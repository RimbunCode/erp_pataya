<?php

namespace Tests\Feature\Finance;

use App\Models\Finance\InstructorEarning;
use App\Models\Finance\InstructorPayoutRequest;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class RunInstructorPayoutBatchCommandTest extends TestCase {
    public function test_command_fails_when_no_eligible_admin_actor_exists(): void {
        $this->artisan('finance:payouts:run-batch')
            ->expectsOutput('Tidak ada admin dengan permission finance_admin/super_admin untuk menjalankan payout batch.')
            ->assertExitCode(1);
    }

    public function test_dry_run_previews_batch_without_creating_requests(): void {
        $admin      = User::factory()->create(['email' => 'finance.operator@inkindo.test']);
        $instructor = User::factory()->create();

        $this->assignRole($admin, 'admin');
        $this->assignRole($instructor, 'instructor');
        $this->grantAdminPermission($admin, 'finance_admin');

        InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'payment_id'        => null,
            'course_id'         => null,
            'gross_amount'      => 120000,
            'company_amount'    => 0,
            'instructor_amount' => 120000,
            'available_at'      => now()->subDay(),
            'released_at'       => null,
        ]);

        $this->artisan('finance:payouts:run-batch', [
            '--actor-email' => 'finance.operator@inkindo.test',
            '--dry-run'     => true,
        ])->assertExitCode(0);

        $this->assertSame(0, InstructorPayoutRequest::query()->count());
    }

    public function test_command_creates_draft_payout_and_prefers_super_admin_as_default_actor(): void {
        $superAdmin   = User::factory()->create(['email' => 'super.admin@inkindo.test']);
        $financeAdmin = User::factory()->create(['email' => 'finance.admin2@inkindo.test']);
        $instructor   = User::factory()->create();

        $this->assignRole($superAdmin, 'admin');
        $this->assignRole($financeAdmin, 'admin');
        $this->assignRole($instructor, 'instructor');

        $this->grantAdminPermission($superAdmin, 'super_admin');
        $this->grantAdminPermission($financeAdmin, 'finance_admin');

        InstructorEarning::query()->create([
            'instructor_id'     => $instructor->id,
            'payment_id'        => null,
            'course_id'         => null,
            'gross_amount'      => 90000,
            'company_amount'    => 0,
            'instructor_amount' => 90000,
            'available_at'      => now()->subDay(),
            'released_at'       => null,
        ]);

        $this->artisan('finance:payouts:run-batch')->assertExitCode(0);

        $payoutRequest = InstructorPayoutRequest::query()->first();
        $this->assertNotNull($payoutRequest);
        $this->assertSame('draft', $payoutRequest->status);
        $this->assertSame((string) $superAdmin->id, (string) $payoutRequest->requested_by);
        $this->assertSame(90000.0, (float) $payoutRequest->requested_amount);
    }

    protected function setUp(): void {
        parent::setUp();

        Artisan::call('migrate:fresh', [
            '--database' => 'sqlite',
            '--path'     => [
                'database/migrations/0001_01_01_000000_create_users_table.php',
                'database/migrations/2025_01_31_135456_create_roles_table.php',
                'database/migrations/2025_01_31_150339_create_permissions_table.php',
                'database/migrations/2025_01_31_152926_create_user_role_table.php',
                'database/migrations/2026_04_26_075938_create_courses_table.php',
                'database/migrations/2026_04_28_074634_create_payments_table.php',
                'database/migrations/2026_05_24_141817_create_admin_user_permissions_table.php',
                'database/migrations/2026_05_24_141817_create_instructor_earnings_table.php',
                'database/migrations/2026_05_24_141817_create_instructor_payout_requests_table.php',
                'database/migrations/2026_05_24_141818_create_instructor_payout_request_items_table.php',
            ],
            '--force' => true,
        ]);
    }

    private function assignRole(User $user, string $roleName): void {
        $role = Role::query()->firstOrCreate(
            ['name' => $roleName],
            [
                'description' => "{$roleName} role",
                'is_disabled' => false,
            ],
        );

        $user->roles()->syncWithoutDetaching([$role->id]);
    }

    private function grantAdminPermission(User $user, string $permissionName): void {
        $permissionId = DB::table('permissions')
            ->where('name', $permissionName)
            ->whereNull('deleted_at')
            ->value('id');

        if (! $permissionId) {
            $permissionId = (string) Str::ulid();
            DB::table('permissions')->insert([
                'id'          => $permissionId,
                'module'      => 'lms',
                'name'        => $permissionName,
                'model'       => User::class,
                'route'       => 'admin.*',
                'permissions' => json_encode(['view']),
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        $exists = DB::table('admin_user_permissions')
            ->where('user_id', $user->id)
            ->where('permission_id', $permissionId)
            ->whereNull('deleted_at')
            ->exists();

        if ($exists) {
            return;
        }

        DB::table('admin_user_permissions')->insert([
            'id'            => (string) Str::ulid(),
            'user_id'       => $user->id,
            'permission_id' => $permissionId,
            'created_at'    => now(),
            'updated_at'    => now(),
            'deleted_at'    => null,
        ]);
    }
}
