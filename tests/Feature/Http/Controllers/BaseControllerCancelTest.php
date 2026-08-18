<?php

namespace Tests\Feature\Http\Controllers;

use App\Enums\FormStatus;
use App\Http\Controllers\Controller;
use App\Models\Core\Log;
use App\Models\Model as AppModel;
use App\Models\User\User;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class BaseControllerCancelTestDocument extends AppModel {
    use HasUlids, Submitable;

    protected $table   = 'base_controller_cancel_test_documents';
    protected $guarded = ['id'];

    public function getRouteKeyName(): string {
        return 'id';
    }
}

class BaseControllerCancelTestService {
    public bool $shouldThrow = false;

    public function cancel(BaseControllerCancelTestDocument $document): BaseControllerCancelTestDocument {
        $document->update(['status' => FormStatus::CANCELED]);

        if ($this->shouldThrow) {
            throw new \RuntimeException('Simulated failure in Service::cancel() AFTER status update — menguji rollback transaksi base Controller::cancel()');
        }

        return $document;
    }
}

class BaseControllerCancelTestController extends Controller {
    public function __construct(Request $request, BaseControllerCancelTestService $service) {
        $this->service = $service;
        parent::__construct($request, BaseControllerCancelTestDocument::class);
    }
}

class BaseControllerCancelTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        // Singleton — instance yang sama harus dipakai controller (via container
        // injection) DAN test (untuk toggle $shouldThrow), bukan instance terpisah.
        $this->app->singleton(BaseControllerCancelTestService::class);

        foreach (['users', 'roles', 'branches', 'general_ledgers', 'stock_ledger_entries', 'logs'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('base_controller_cancel_test_documents')) {
            Schema::create('base_controller_cancel_test_documents', function ($t) {
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

        Route::middleware(['web'])->put(
            '/test-base-controller-cancel/{baseControllerCancelTestDocument}/cancel',
            [BaseControllerCancelTestController::class, 'cancel'],
        )->name('testBaseControllerCancel.cancel');

        $this->app['router']->getRoutes()->refreshNameLookups();
    }

    private function cancelUrl(string $id): string {
        return '/test-base-controller-cancel/' . $id . '/cancel';
    }

    private function makeUser(): User {
        $id = (string) Str::ulid();
        DB::table('users')->insert([
            'id'         => $id,
            'name'       => 'Tester',
            'email'      => $id . '@test.com',
            'password'   => null,
            'status'     => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::find($id);
    }

    private function makeDocument(User $creator, FormStatus $status): BaseControllerCancelTestDocument {
        return BaseControllerCancelTestDocument::create([
            'id'            => (string) Str::ulid(),
            'created_by_id' => $creator->id,
            'code'          => 'DOC-' . Str::random(6),
            'status'        => $status,
        ]);
    }

    /**
     * Format persis yang dibaca Controller::__construct() / DataTable::_checkPermission():
     * session('permissions')[Model::class][level] = [['permissions' => [...], 'only_creator' => bool]].
     */
    private function cancelPermissionSession(): array {
        return [
            'permissions' => [
                BaseControllerCancelTestDocument::class => [
                    0 => [
                        ['permissions' => ['cancel' => true], 'only_creator' => false],
                    ],
                ],
            ],
        ];
    }

    public function test_cancel_without_permission_returns_403(): void {
        $user = $this->makeUser();
        $doc  = $this->makeDocument($user, FormStatus::NEED_APPROVAL);

        $response = $this->actingAs($user)
            ->withSession(['permissions' => []])
            ->putJson($this->cancelUrl($doc->id));

        $response->assertStatus(403);
    }

    public function test_cancel_with_permission_but_cancannot_returns_422(): void {
        $user = $this->makeUser();
        $doc  = $this->makeDocument($user, FormStatus::DRAFT);

        $response = $this->actingAs($user)
            ->withSession($this->cancelPermissionSession())
            ->putJson($this->cancelUrl($doc->id));

        $response->assertStatus(422);
        $this->assertTrue(\in_array(FormStatus::DRAFT, (array) $doc->fresh()->status));
    }

    public function test_cancel_success_updates_status_and_logs(): void {
        $user = $this->makeUser();
        $doc  = $this->makeDocument($user, FormStatus::NEED_APPROVAL);

        $response = $this->actingAs($user)
            ->withSession($this->cancelPermissionSession())
            ->putJson($this->cancelUrl($doc->id));

        $response->assertStatus(302);
        $this->assertTrue(\in_array(FormStatus::CANCELED, (array) $doc->fresh()->status));

        $log = Log::where('loggable_id', $doc->id)
            ->where('loggable_type', BaseControllerCancelTestDocument::class)
            ->first();
        $this->assertNotNull($log, 'logForCancelled() harus membuat entri Log');
    }

    public function test_cancel_rolls_back_status_when_service_throws(): void {
        $user = $this->makeUser();
        $doc  = $this->makeDocument($user, FormStatus::NEED_APPROVAL);

        app(BaseControllerCancelTestService::class)->shouldThrow = true;

        $response = $this->actingAs($user)
            ->withSession($this->cancelPermissionSession())
            ->put($this->cancelUrl($doc->id));

        $response->assertStatus(500);

        $this->assertTrue(
            \in_array(FormStatus::NEED_APPROVAL, (array) $doc->fresh()->status),
            'Status harus tetap NEED_APPROVAL (rollback), bukan CANCELED, saat Service::cancel() gagal',
        );
    }
}
