<?php

namespace Tests\Feature\Core;

use App\Http\Controllers\Core\FileController;
use App\Models\Core\File;
use App\Models\Core\Fileable;
use App\Models\Model as AppModel;
use App\Models\User\User;
use App\Traits\DataTable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class GeneratedPdfTestDocument extends AppModel {
    use DataTable, HasUlids;

    protected $table   = 'generated_pdf_test_documents';
    protected $guarded = ['id'];
    public $timestamps = false;
}

/**
 * PDF hasil generate (auto-attach saat approval) dibuat tanpa pemilik (created_by_id null) oleh
 * worker queue. Aksesnya harus mengikuti hak baca dokumen induknya, bukan sekadar "sudah login",
 * dan tidak boleh muncul di library file global.
 */
class FileGeneratedPdfAccessTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            if (! Schema::hasColumn($tableInfo['name'], 'is_example')) {
                Schema::table($tableInfo['name'], fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
        Schema::table('files', function ($t) {
            foreach (['parent_id', 'lft', 'rgt', 'depth'] as $column) {
                if (! Schema::hasColumn('files', $column)) {
                    $column === 'parent_id' ? $t->ulid($column)->nullable() : $t->unsignedBigInteger($column)->nullable();
                }
            }
        });
        Schema::create('generated_pdf_test_documents', function ($t) {
            $t->ulid('id')->primary();
            $t->ulid('created_by_id')->nullable();
        });
        Storage::fake();
    }

    private function permissions(bool $read, bool $onlyCreator = false): array {
        return [GeneratedPdfTestDocument::class => [0 => [[
            'model'        => GeneratedPdfTestDocument::class,
            'level'        => 0,
            'only_creator' => $onlyCreator,
            'permissions'  => ['read' => $read],
        ]]]];
    }

    private function request(User $user): Request {
        $request = Request::create('/', 'GET', [], [], [], ['HTTP_X_REQUESTED_WITH' => 'XMLHttpRequest']);
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    /** @return array{0: File, 1: GeneratedPdfTestDocument} */
    private function makeGeneratedPdf(?string $documentCreatorId = null): array {
        $document = GeneratedPdfTestDocument::create(['created_by_id' => $documentCreatorId]);
        $path     = 'files/' . Str::ulid() . '.pdf';
        Storage::put($path, '%PDF-1.4 test');
        $file = File::create(['name' => 'doc', 'path' => $path, 'extension' => 'pdf', 'mime_type' => 'application/pdf', 'is_public' => false, 'created_by_id' => null]);
        Fileable::create(['fileable_id' => $document->id, 'fileable_type' => GeneratedPdfTestDocument::class, 'file_id' => $file->id, 'is_generated_pdf' => true]);

        return [$file, $document];
    }

    private function preview(User $user, File $file): int {
        $this->actingAs($user);

        try {
            return app(FileController::class)->preview($this->request($user), $file)->getStatusCode();
        } catch (HttpException $e) {
            return $e->getStatusCode();
        }
    }

    public function test_user_who_can_read_the_document_may_open_its_generated_pdf(): void {
        [$file] = $this->makeGeneratedPdf();
        Session::put('permissions', $this->permissions(read: true));

        $this->assertSame(200, $this->preview(User::factory()->create(), $file));
    }

    public function test_user_without_read_permission_on_document_is_denied(): void {
        [$file] = $this->makeGeneratedPdf();
        Session::put('permissions', $this->permissions(read: false));

        $this->assertSame(403, $this->preview(User::factory()->create(), $file));
    }

    public function test_user_without_any_permission_entry_is_denied(): void {
        [$file] = $this->makeGeneratedPdf();
        Session::put('permissions', []);

        $this->assertSame(403, $this->preview(User::factory()->create(), $file));
    }

    public function test_only_creator_permission_restricts_to_documents_created_by_user(): void {
        $owner  = User::factory()->create();
        $other  = User::factory()->create();
        [$file] = $this->makeGeneratedPdf($owner->id);
        Session::put('permissions', $this->permissions(read: true, onlyCreator: true));

        $this->assertSame(200, $this->preview($owner, $file));
        $this->assertSame(403, $this->preview($other, $file));
    }

    public function test_generated_pdf_of_missing_document_is_denied(): void {
        [$file, $document] = $this->makeGeneratedPdf();
        DB::table('generated_pdf_test_documents')->where('id', $document->id)->delete();
        Session::put('permissions', $this->permissions(read: true));

        $this->assertSame(403, $this->preview(User::factory()->create(), $file));
    }

    public function test_regular_file_without_attachment_keeps_login_only_behaviour(): void {
        Storage::put('files/plain.txt', 'hello');
        $file = File::create(['name' => 'plain', 'path' => 'files/plain.txt', 'extension' => 'txt', 'mime_type' => 'text/plain', 'is_public' => false, 'created_by_id' => null]);
        Session::put('permissions', []);

        $this->assertSame(200, $this->preview(User::factory()->create(), $file));
    }

    public function test_generated_pdf_is_excluded_from_global_file_library(): void {
        $user        = User::factory()->create();
        [$generated] = $this->makeGeneratedPdf();
        $plain       = File::create(['name' => 'plain', 'path' => 'files/plain.txt', 'extension' => 'txt', 'mime_type' => 'text/plain', 'is_public' => false, 'created_by_id' => null]);
        $this->actingAs($user);

        $response = app(FileController::class)->index($this->request($user));
        $ids      = collect($response->getData())->pluck('id');

        $this->assertTrue($ids->contains($plain->id));
        $this->assertFalse($ids->contains($generated->id));
    }
}
