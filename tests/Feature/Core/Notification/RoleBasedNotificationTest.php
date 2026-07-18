<?php

namespace Tests\Feature\Core\Notification;

use App\Enums\FormStatus;
use App\Models\Model as AppModel;
use App\Models\User\Role;
use App\Models\User\User;
use App\Notifications\DocumentSubmittedNotification;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class RoleBasedTestDocument extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'role_based_test_documents';
    protected $guarded = ['id'];

    protected static function notifyRolesOnStatus(): array {
        return [
            'submitted' => ['Warehouse'],
        ];
    }
}

class RoleBasedTestDocumentUnconfigured extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'role_based_test_documents';
    protected $guarded = ['id'];
}

class RoleBasedNotificationTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (['roles', 'users', 'general_ledgers', 'stock_ledger_entries'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('role_based_test_documents')) {
            Schema::create('role_based_test_documents', function ($t) {
                $t->ulid('id')->primary();
                $t->ulid('created_by_id')->nullable();
                $t->string('code')->nullable();
                $t->string('status')->default('draft');
                $t->boolean('is_example')->default(false);
                $t->timestamp('submitted_at')->nullable();
                $t->timestamp('canceled_at')->nullable();
                $t->char('amended_from_id', 26)->nullable();
                $t->integer('revision_number')->default(0);
                $t->timestamps();
                $t->softDeletes();
            });
        }
    }

    private function makeUser(string $name): User {
        $id = (string) Str::ulid();
        DB::table('users')->insert([
            'id'         => $id,
            'name'       => $name,
            'email'      => $id . '@test.com',
            'password'   => null,
            'status'     => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::find($id);
    }

    private function makeRole(string $name): Role {
        $id = (string) Str::ulid();
        DB::table('roles')->insert([
            'id'          => $id,
            'name'        => $name,
            'description' => '',
            'is_disabled' => 0,
            'is_example'  => 0,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        return Role::find($id);
    }

    private function assignRole(User $user, Role $role): void {
        DB::table('user_role')->insertOrIgnore([
            'user_id'    => $user->id,
            'role_id'    => $role->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_configured_status_transition_notifies_all_users_with_matching_role_only(): void {
        Notification::fake();

        $warehouseRole  = $this->makeRole('Warehouse');
        $otherRole      = $this->makeRole('Sales');
        $warehouseUser1 = $this->makeUser('WarehouseUser1');
        $warehouseUser2 = $this->makeUser('WarehouseUser2');
        $otherUser      = $this->makeUser('SalesUser');
        $this->assignRole($warehouseUser1, $warehouseRole);
        $this->assignRole($warehouseUser2, $warehouseRole);
        $this->assignRole($otherUser, $otherRole);
        $creator = $this->makeUser('DocCreator');

        $doc = RoleBasedTestDocument::create([
            'id'            => (string) Str::ulid(),
            'created_by_id' => $creator->id,
            'code'          => 'RB-001',
            'status'        => FormStatus::DRAFT,
        ]);

        $doc->update(['status' => FormStatus::SUBMITTED]);

        Notification::assertSentTo($warehouseUser1, DocumentSubmittedNotification::class);
        Notification::assertSentTo($warehouseUser2, DocumentSubmittedNotification::class);
        Notification::assertNotSentTo($otherUser, DocumentSubmittedNotification::class);
    }

    public function test_unconfigured_model_sends_no_notification(): void {
        Notification::fake();

        $role = $this->makeRole('WarehouseUnused');
        $user = $this->makeUser('UnusedUser');
        $this->assignRole($user, $role);
        $creator = $this->makeUser('UnconfiguredCreator');

        $doc = RoleBasedTestDocumentUnconfigured::create([
            'id'            => (string) Str::ulid(),
            'created_by_id' => $creator->id,
            'code'          => 'RB-002',
            'status'        => FormStatus::DRAFT,
        ]);

        $doc->update(['status' => FormStatus::SUBMITTED]);

        Notification::assertNothingSent();
    }

    public function test_configured_role_with_no_matching_users_sends_no_notification_without_error(): void {
        Notification::fake();

        $creator = $this->makeUser('NoUsersCreator');

        $doc = RoleBasedTestDocument::create([
            'id'            => (string) Str::ulid(),
            'created_by_id' => $creator->id,
            'code'          => 'RB-003',
            'status'        => FormStatus::DRAFT,
        ]);

        // Tidak ada exception meski role 'Warehouse' tidak terkonfigurasi
        // dengan user manapun di database.
        $doc->update(['status' => FormStatus::SUBMITTED]);

        Notification::assertNothingSent();
    }
}
