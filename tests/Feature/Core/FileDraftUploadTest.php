<?php

namespace Tests\Feature\Core;

use App\Models\Core\File;
use App\Models\Inventory\Unit;
use App\Models\User\User;
use App\Services\Core\BufferedAttachmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FileDraftUploadTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // Kolom infra File yang di prod ditambah via command init, bukan migration.
        Schema::table('files', function ($t) {
            if (! Schema::hasColumn('files', 'user_id')) {
                $t->ulid('user_id')->nullable();
            }
            if (! Schema::hasColumn('files', 'parent_id')) {
                $t->ulid('parent_id')->nullable();
            }
            if (! Schema::hasColumn('files', 'lft')) {
                $t->unsignedBigInteger('lft')->nullable();
            }
            if (! Schema::hasColumn('files', 'rgt')) {
                $t->unsignedBigInteger('rgt')->nullable();
            }
            if (! Schema::hasColumn('files', 'depth')) {
                $t->unsignedBigInteger('depth')->nullable();
            }
        });
    }

    public function test_upload_with_draft_flag_marks_file_as_draft(): void {
        // Menguji logic inti yang dipakai FileController::store:
        // File::uploadFile dengan defaultValue is_draft=true (tanpa HTTP path
        // yang memicu OOM di error-logging middleware test env).
        Storage::fake('local');
        $user = User::factory()->create();
        $this->actingAs($user);

        $request = Request::create('/', 'POST', [
            'isPublic' => ['false'],
            'name'     => ['doc'],
        ], [], [
            'files' => [UploadedFile::fake()->create('doc.pdf', 10)],
        ]);
        $request->setUserResolver(fn () => $user);

        $uploaded = [];
        File::uploadFile($request, 'drafts', function ($file) use (&$uploaded) {
            $uploaded[] = ['id' => $file->id, 'name' => $file->name];
        }, ['is_draft' => true]);

        $this->assertCount(1, $uploaded);
        $file = File::find($uploaded[0]['id']);
        $this->assertTrue($file->is_draft);
        $this->assertSame('doc', $file->name);
    }

    public function test_attaching_draft_file_via_files_id_clears_is_draft(): void {
        $user = User::factory()->create();
        $this->actingAs($user);
        $draft = File::create([
            'name'      => 'doc',
            'path'      => 'files/doc.pdf',
            'extension' => 'pdf',
            'mime_type' => 'application/pdf',
            'is_draft'  => true,
            'user_id'   => $user->id,
        ]);
        $unit = Unit::create(['code' => 'BX', 'name' => 'Box', 'group' => 'Others']);

        $request = Request::create('/', 'POST', ['filesId' => [$draft->id]]);
        $request->setUserResolver(fn () => $user);

        BufferedAttachmentService::attach($unit, $request);

        $this->assertDatabaseHas('fileables', [
            'fileable_id'   => $unit->id,
            'fileable_type' => Unit::class,
            'file_id'       => $draft->id,
        ]);
        $this->assertFalse($draft->fresh()->is_draft);
    }
}
