<?php

namespace Tests\Feature;

use App\Jobs\Core\ReplayHaveTransactionsSyncJob;
use App\Models\Model;
use App\Services\Core\HaveTransactionsSyncService;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class HaveTransactionsSyncTest extends TestCase {
    private string $sqliteDatabasePath;

    protected function setUp(): void {
        parent::setUp();

        $this->sqliteDatabasePath = database_path('have-transactions-test.sqlite');
        if (file_exists($this->sqliteDatabasePath)) {
            unlink($this->sqliteDatabasePath);
        }
        touch($this->sqliteDatabasePath);

        config()->set('database.connections.sqlite.database', $this->sqliteDatabasePath);
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        config()->set('have_transactions.enabled', true);
        config()->set('have_transactions.enforce_delete_guard', true);
        config()->set('have_transactions.runtime_mode', 'sync');
        config()->set('have_transactions.metadata_cache_enabled', true);
        config()->set('have_transactions.metadata_cache_ttl_seconds', 600);
        config()->set('have_transactions.metadata_cache_prefix', 'have_transactions_test');
        config()->set('have_transactions.runtime_debug_log', false);
        config()->set('have_transactions.async_replay_enabled', false);
        config()->set('have_transactions.tracked_tables', [
            'test_have_transaction_parents',
            'test_have_transaction_targets',
        ]);
        config()->set('have_transactions.excluded_source_tables', []);
        config()->set('have_transactions.excluded_target_tables', []);
        config()->set('have_transactions.excluded_morph_relations', []);
        config()->set('have_transactions.excluded_submitable_statuses', ['canceled', 'rejected']);
        config()->set('cache.default', 'array');

        Schema::dropIfExists('test_have_transaction_plain_models');
        Schema::dropIfExists('test_have_transaction_children');
        Schema::dropIfExists('test_have_transaction_targets');
        Schema::dropIfExists('test_have_transaction_parents');

        Schema::create('test_have_transaction_parents', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name')->nullable();
            $table->boolean('have_transactions')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('test_have_transaction_targets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name')->nullable();
            $table->boolean('have_transactions')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('test_have_transaction_children', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('parent_id')->nullable()->references('id')->on('test_have_transaction_parents')->nullOnDelete();
            $table->string('attachable_type')->nullable();
            $table->char('attachable_id', 26)->nullable();
            $table->json('status')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('test_have_transaction_plain_models', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void {
        parent::tearDown();

        DB::purge('sqlite');
        if (isset($this->sqliteDatabasePath) && file_exists($this->sqliteDatabasePath)) {
            unlink($this->sqliteDatabasePath);
        }
    }

    public function test_runtime_sync_sets_parent_have_transactions_for_belongs_to_and_morph(): void {
        $parent = TestHaveTransactionsParent::create([
            'name' => 'Parent A',
        ]);

        $target = TestHaveTransactionsTarget::create([
            'name' => 'Target A',
        ]);

        TestHaveTransactionsChild::create([
            'parent_id'       => $parent->id,
            'attachable_type' => TestHaveTransactionsTarget::class,
            'attachable_id'   => $target->id,
            'status'          => json_encode(['draft']),
        ]);

        $this->assertSame(1, (int) $parent->fresh()->have_transactions);
        $this->assertSame(1, (int) $target->fresh()->have_transactions);
    }

    public function test_delete_guard_blocks_delete_when_have_transactions_is_true(): void {
        $parent = TestHaveTransactionsParent::create([
            'name'              => 'Parent Guard',
            'have_transactions' => true,
        ]);

        $this->expectException(ValidationException::class);

        $parent->delete();
    }

    public function test_recalculate_command_resets_and_rebuilds_from_active_references_only(): void {
        $activeParent = TestHaveTransactionsParent::create([
            'name'              => 'Active Parent',
            'have_transactions' => false,
        ]);

        $inactiveParent = TestHaveTransactionsParent::create([
            'name'              => 'Inactive Parent',
            'have_transactions' => true,
        ]);

        TestHaveTransactionsChild::create([
            'parent_id' => $activeParent->id,
            'status'    => json_encode(['draft']),
        ]);

        TestHaveTransactionsChild::create([
            'parent_id' => $inactiveParent->id,
            'status'    => json_encode(['canceled']),
        ]);

        $deletedChild = TestHaveTransactionsChild::create([
            'parent_id' => $inactiveParent->id,
            'status'    => json_encode(['draft']),
        ]);
        $deletedChild->update([
            'deleted_at' => now(),
        ]);

        $this->artisan('have-transactions:sync', [
            '--only'  => 'test_have_transaction_parents',
            '--chunk' => 50,
        ])->assertExitCode(0);

        $this->assertSame(1, (int) $activeParent->fresh()->have_transactions);
        $this->assertSame(0, (int) $inactiveParent->fresh()->have_transactions);
    }

    public function test_runtime_sync_remains_correct_when_metadata_cache_enabled(): void {
        config()->set('have_transactions.metadata_cache_enabled', true);

        $parent = TestHaveTransactionsParent::create([
            'name' => 'Parent Cache Enabled',
        ]);

        $target = TestHaveTransactionsTarget::create([
            'name' => 'Target Cache Enabled',
        ]);

        for ($i = 0; $i < 3; $i++) {
            $this->app->forgetInstance(HaveTransactionsSyncService::class);

            TestHaveTransactionsChild::create([
                'parent_id'       => $parent->id,
                'attachable_type' => TestHaveTransactionsTarget::class,
                'attachable_id'   => $target->id,
                'status'          => json_encode(['draft']),
            ]);
        }

        $this->assertSame(1, (int) $parent->fresh()->have_transactions);
        $this->assertSame(1, (int) $target->fresh()->have_transactions);
    }

    public function test_runtime_sync_remains_correct_when_metadata_cache_disabled(): void {
        config()->set('have_transactions.metadata_cache_enabled', false);

        $parent = TestHaveTransactionsParent::create([
            'name' => 'Parent Cache Disabled',
        ]);

        $target = TestHaveTransactionsTarget::create([
            'name' => 'Target Cache Disabled',
        ]);

        for ($i = 0; $i < 3; $i++) {
            $this->app->forgetInstance(HaveTransactionsSyncService::class);

            TestHaveTransactionsChild::create([
                'parent_id'       => $parent->id,
                'attachable_type' => TestHaveTransactionsTarget::class,
                'attachable_id'   => $target->id,
                'status'          => json_encode(['draft']),
            ]);
        }

        $this->assertSame(1, (int) $parent->fresh()->have_transactions);
        $this->assertSame(1, (int) $target->fresh()->have_transactions);
    }

    public function test_runtime_sync_falls_back_when_cache_layer_fails(): void {
        Cache::shouldReceive('remember')->andThrow(new \RuntimeException('Cache unavailable'));

        $parent = TestHaveTransactionsParent::create([
            'name' => 'Parent Cache Failure',
        ]);

        $target = TestHaveTransactionsTarget::create([
            'name' => 'Target Cache Failure',
        ]);

        TestHaveTransactionsChild::create([
            'parent_id'       => $parent->id,
            'attachable_type' => TestHaveTransactionsTarget::class,
            'attachable_id'   => $target->id,
            'status'          => json_encode(['draft']),
        ]);

        $this->assertSame(1, (int) $parent->fresh()->have_transactions);
        $this->assertSame(1, (int) $target->fresh()->have_transactions);
    }

    public function test_hybrid_mode_can_dispatch_async_replay_job_after_commit(): void {
        Queue::fake();

        config()->set('have_transactions.runtime_mode', 'hybrid');
        config()->set('have_transactions.async_replay_enabled', true);

        $parent = TestHaveTransactionsParent::create([
            'name' => 'Parent Hybrid',
        ]);

        TestHaveTransactionsChild::create([
            'parent_id' => $parent->id,
            'status'    => json_encode(['draft']),
        ]);

        Queue::assertPushed(ReplayHaveTransactionsSyncJob::class);
        $this->assertSame(1, (int) $parent->fresh()->have_transactions);
    }

    public function test_runtime_benchmark_cache_enabled_is_not_slower_than_disabled_by_large_margin(): void {
        $disabledDuration = $this->measureRuntimeSyncDuration(false, 15);
        $enabledDuration  = $this->measureRuntimeSyncDuration(true, 15);

        $this->assertLessThanOrEqual($disabledDuration * 1.75, $enabledDuration);
    }

    public function test_model_without_soft_deletes_can_boot_link_model_without_restored_hook_error(): void {
        $model = TestHaveTransactionsPlainModel::create([
            'name' => 'Plain Model',
        ]);

        $this->assertNotNull($model->id);
        $this->assertNotNull($model->fresh());
    }

    private function measureRuntimeSyncDuration(bool $metadataCacheEnabled, int $iterations): float {
        config()->set('have_transactions.metadata_cache_enabled', $metadataCacheEnabled);

        $parent = TestHaveTransactionsParent::create([
            'name' => fake()->word(),
        ]);

        $target = TestHaveTransactionsTarget::create([
            'name' => fake()->word(),
        ]);

        $startedAt = hrtime(true);
        for ($i = 0; $i < $iterations; $i++) {
            $this->app->forgetInstance(HaveTransactionsSyncService::class);

            TestHaveTransactionsChild::create([
                'parent_id'       => $parent->id,
                'attachable_type' => TestHaveTransactionsTarget::class,
                'attachable_id'   => $target->id,
                'status'          => json_encode(['draft']),
            ]);
        }

        return (hrtime(true) - $startedAt) / 1_000_000;
    }
}

class TestHaveTransactionsParent extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'test_have_transaction_parents';
    protected $guarded = ['id'];
}

class TestHaveTransactionsTarget extends Model {
    use HasUlids, SoftDeletes;

    protected $table   = 'test_have_transaction_targets';
    protected $guarded = ['id'];
}

class TestHaveTransactionsChild extends Model {
    use HasUlids, SoftDeletes;

    protected static bool $is_submitable = true;
    protected $table                     = 'test_have_transaction_children';
    protected $guarded                   = ['id'];
}

class TestHaveTransactionsPlainModel extends Model {
    use HasUlids;

    protected $table   = 'test_have_transaction_plain_models';
    protected $guarded = ['id'];
}
