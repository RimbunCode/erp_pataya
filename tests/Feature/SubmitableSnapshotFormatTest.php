<?php

namespace Tests\Feature;

use App\Enums\FormStatus;
use App\Models\Model;
use App\Traits\Submitable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SubmitableSnapshotFormatTest extends TestCase {
    private string $sqliteDatabasePath;

    protected function setUp(): void {
        parent::setUp();

        $this->sqliteDatabasePath = database_path('submitable-snapshot-test.sqlite');
        if (file_exists($this->sqliteDatabasePath)) {
            unlink($this->sqliteDatabasePath);
        }
        touch($this->sqliteDatabasePath);

        config()->set('database.connections.sqlite.database', $this->sqliteDatabasePath);
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        config()->set('have_transactions.enabled', false);
        config()->set('command_search.enabled', false);

        Schema::dropIfExists('formating_series');
        Schema::dropIfExists('test_submitable_documents');

        Schema::create('formating_series', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('model')->unique();
            $table->text('logs')->nullable();
            $table->string('format');
            $table->timestamps();
        });

        Schema::create('test_submitable_documents', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('code');
            $table->text('status')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->unsignedTinyInteger('revision_number')->default(0);
            $table->string('amended_from_id')->nullable();
            $table->text('additional_data')->nullable();
            $table->string('submitted_format')->nullable();
            $table->string('created_by_id')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    protected function tearDown(): void {
        parent::tearDown();

        DB::purge('sqlite');
        if (isset($this->sqliteDatabasePath) && file_exists($this->sqliteDatabasePath)) {
            unlink($this->sqliteDatabasePath);
        }
    }

    public function test_submitted_format_updates_when_code_is_dirty_and_keeps_raw_format(): void {
        $initialFormat = 'PR-@[yyyy]-@[iiii]';
        DB::table('formating_series')->insert([
            'id'         => (string) str()->ulid(),
            'name'       => 'Purchase Request',
            'model'      => SubmitableSnapshotDocument::class,
            'logs'       => json_encode([]),
            'format'     => $initialFormat,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $document = SubmitableSnapshotDocument::create([
            'code' => 'TEMP-001',
        ]);
        $document->refresh();
        $this->assertSame($initialFormat, $document->submitted_format);

        $document->status = [FormStatus::SUBMITTED];
        $document->save();
        $document->refresh();
        $this->assertSame($initialFormat, $document->submitted_format);

        $updatedFormat = 'PR-REV-@[yyyy]-@[iiii]';
        DB::table('formating_series')
            ->where('model', SubmitableSnapshotDocument::class)
            ->update([
                'format'     => $updatedFormat,
                'updated_at' => now(),
            ]);

        $document->status = [FormStatus::APPROVED];
        $document->save();
        $document->refresh();
        $this->assertSame($initialFormat, $document->submitted_format);

        $document->code = 'TEMP-002';
        $document->save();
        $document->refresh();

        $this->assertSame($updatedFormat, $document->submitted_format);
    }

    public function test_amended_document_sets_submitted_format_on_create_from_dirty_code(): void {
        $format = 'PR-@[iiii]';
        DB::table('formating_series')->insert([
            'id'         => (string) str()->ulid(),
            'name'       => 'Purchase Request',
            'model'      => SubmitableSnapshotDocument::class,
            'logs'       => json_encode([]),
            'format'     => $format,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $original = SubmitableSnapshotDocument::create([
            'code' => 'PR-0001',
        ]);
        $original->status = [FormStatus::SUBMITTED];
        $original->save();
        $original->refresh();
        $this->assertSame($format, $original->submitted_format);

        $amended = $original->amend(false);
        $amended->refresh();

        $this->assertSame($format, $amended->submitted_format);
    }
}

class SubmitableSnapshotDocument extends Model {
    use HasUlids, SoftDeletes, Submitable;

    protected static bool $is_submitable = true;
    protected $table                     = 'test_submitable_documents';
    protected $guarded                   = ['id'];

    public static function templateLink() {
        return ':code';
    }

    public function logForAmended() {
        // Disabled in test to avoid external log table dependency.
    }

    public function logForCreated() {
        // Disabled in test to avoid external log table dependency.
    }
}
