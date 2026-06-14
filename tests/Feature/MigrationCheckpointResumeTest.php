<?php

namespace Tests\Feature;

use App\Services\Migration\BaseMigrator;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class MigrationCheckpointResumeTest extends TestCase {
    protected string $recordsTable         = 'migration_checkpoint_test_records';
    protected bool $createdCheckpointTable = false;

    protected function setUp(): void {
        parent::setUp();

        if (! Schema::hasTable('migration_checkpoints')) {
            Schema::create('migration_checkpoints', function (Blueprint $table): void {
                $table->string('migrator');
                $table->string('checkpoint_key');
                $table->string('last_processed_key');
                $table->unique(['migrator', 'checkpoint_key']);
                $table->timestamps();
            });

            $this->createdCheckpointTable = true;
        }

        Schema::dropIfExists($this->recordsTable);
        Schema::create($this->recordsTable, function (Blueprint $table): void {
            $table->unsignedInteger('id')->primary();
            $table->string('name');
            $table->timestamps();
        });
    }

    protected function tearDown(): void {
        Schema::dropIfExists($this->recordsTable);

        if ($this->createdCheckpointTable) {
            Schema::dropIfExists('migration_checkpoints');
        }

        parent::tearDown();
    }

    public function test_chunk_processing_can_resume_from_last_checkpoint(): void {
        DB::table($this->recordsTable)->insert([
            ['id' => 1, 'name' => 'A', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'name' => 'B', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'name' => 'C', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 4, 'name' => 'D', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 5, 'name' => 'E', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $migrator  = new TestCheckpointMigrator($this->recordsTable);
        $processed = [];

        try {
            $migrator->process($processed, failAtId: 3);
            $this->fail('Expected process to throw RuntimeException at id 3.');
        } catch (RuntimeException) {
            // expected
        }

        $this->assertSame([1, 2], $processed);
        $this->assertSame('2', $migrator->getLastCheckpoint('records'));

        $migrator->process($processed);

        $this->assertSame([1, 2, 3, 4, 5], $processed);
        $this->assertNull($migrator->getLastCheckpoint('records'));
    }
}

class TestCheckpointMigrator extends BaseMigrator {
    public function __construct(private readonly string $table) {}

    public function migrate(): void {}

    /**
     * @param  array<int, int>  $processed
     */
    public function process(array &$processed, ?int $failAtId = null): void {
        $this->processChunkedWithCheckpoint(
            DB::table($this->table),
            'records',
            'id',
            function (object $record) use (&$processed, $failAtId): void {
                $recordId = (int) $record->id;

                if ($failAtId !== null && $recordId === $failAtId) {
                    throw new RuntimeException("Simulated error at id {$recordId}");
                }

                $processed[] = $recordId;
            },
        );
    }

    public function getLastCheckpoint(string $key): ?string {
        return $this->getCheckpoint($key);
    }
}
