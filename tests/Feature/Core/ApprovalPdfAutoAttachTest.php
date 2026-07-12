<?php

namespace Tests\Feature\Core;

use App\Enums\FormStatus;
use App\Http\Controllers\Controller;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalInstanceStep;
use App\Models\Core\Fileable;
use App\Models\Core\PrintTemplate;
use App\Models\Model as AppModel;
use App\Models\User\Role;
use App\Models\User\User;
use App\Services\Core\PrintTemplate\PdfExportService;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class PdfAttachTestDocument extends AppModel {
    use HasUlids;

    protected $table   = 'pdf_attach_test_documents';
    protected $guarded = ['id'];
    public $timestamps = false;

    public function getRouteKeyName(): string {
        return 'id';
    }
}

class PdfAttachTestDocumentController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, PdfAttachTestDocument::class);
    }

    public function onApproved(PdfAttachTestDocument $pdfAttachTestDocument) {
        $pdfAttachTestDocument->update(['status' => 'approved']);

        return back();
    }
}

class ApprovalPdfAutoAttachTest extends TestCase {
    use RefreshDatabase;

    private string $permissionId;

    protected function setUp(): void {
        parent::setUp();

        foreach (['approval_schemes', 'approval_scheme_steps', 'roles', 'users', 'approval_instances', 'approval_instance_steps', 'print_templates'] as $tbl) {
            if (Schema::hasTable($tbl) && ! Schema::hasColumn($tbl, 'is_example')) {
                Schema::table($tbl, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! Schema::hasTable('pdf_attach_test_documents')) {
            Schema::create('pdf_attach_test_documents', function ($t) {
                $t->ulid('id')->primary();
                $t->ulid('created_by_id')->nullable();
                $t->string('code')->nullable();
                $t->string('status')->default('need_approval');
            });
        }

        // `files` already exists from the real migration (RefreshDatabase
        // runs it) but is missing columns that are only added dynamically
        // in production via DataTable::initPermissions() / TreeView — add
        // them here the same way BufferedAttachmentServiceTest does, since
        // Schema::create() would be a no-op on an existing table.
        if (Schema::hasTable('files')) {
            Schema::table('files', function ($t) {
                if (! Schema::hasColumn('files', 'is_example')) {
                    $t->boolean('is_example')->default(false);
                }
                if (! Schema::hasColumn('files', 'lft')) {
                    $t->integer('lft')->nullable();
                }
                if (! Schema::hasColumn('files', 'rgt')) {
                    $t->integer('rgt')->nullable();
                }
                if (! Schema::hasColumn('files', 'depth')) {
                    $t->integer('depth')->nullable();
                }
                if (! Schema::hasColumn('files', 'parent_id')) {
                    $t->char('parent_id', 26)->nullable();
                }
            });
        } else {
            Schema::create('files', function ($t) {
                $t->ulid('id')->primary();
                $t->string('name');
                $t->text('path')->nullable();
                $t->string('extension')->nullable();
                $t->string('mime_type');
                $t->boolean('is_public')->default(false);
                $t->boolean('is_draft')->default(false);
                $t->boolean('is_example')->default(false);
                $t->char('created_by_id', 26)->nullable();
                $t->integer('lft')->nullable();
                $t->integer('rgt')->nullable();
                $t->integer('depth')->nullable();
                $t->char('parent_id', 26)->nullable();
                $t->timestamps();
                $t->softDeletes();
            });
        }

        if (! Schema::hasTable('fileables')) {
            Schema::create('fileables', function ($t) {
                $t->char('file_id', 26);
                $t->ulidMorphs('fileable');
                $t->timestamps();
                $t->softDeletes();
            });
        }

        $this->permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'                 => $this->permissionId,
            'module'             => 'test',
            'name'               => 'PdfAttachTestDocument',
            'model'              => PdfAttachTestDocument::class,
            'route'              => 'test',
            'permissions'        => '[]',
            'is_submitable'      => 1,
            'allow_only_creator' => 0,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);
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

    private function makeScheme(string $name, Role $role): string {
        $schemeId = (string) Str::ulid();
        DB::table('approval_schemes')->insert([
            'id'            => $schemeId,
            'name'          => $name,
            'permission_id' => $this->permissionId,
            'name_model'    => 'PdfAttachTestDocument',
            'model'         => PdfAttachTestDocument::class,
            'is_active'     => 1,
            'is_example'    => 0,
            'trigger_on'    => 'submit',
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        DB::table('approval_scheme_steps')->insert([
            'id'                 => (string) Str::ulid(),
            'sequence'           => 0,
            'approval_scheme_id' => $schemeId,
            'approver_type'      => 'role',
            'approverable_type'  => Role::class,
            'approverable_id'    => $role->id,
            'is_advanced'        => false,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        return $schemeId;
    }

    private function makeDocument(User $creator): PdfAttachTestDocument {
        $id = (string) Str::ulid();
        DB::table('pdf_attach_test_documents')->insert([
            'id'            => $id,
            'created_by_id' => $creator->id,
            'code'          => 'DOC-' . substr($id, 0, 6),
        ]);

        return PdfAttachTestDocument::find($id);
    }

    private function approveViaHttp(User $approver, ApprovalInstanceStep $step) {
        return $this->actingAs($approver)
            ->withoutMiddleware([AppMiddleware::class, EnsureUserIsOnboarded::class, LanguageMiddleware::class])
            ->postJson(route('approvalInstances.decision', $step->id), ['decision' => 'approve']);
    }

    public function test_approval_completion_attaches_generated_pdf_to_document(): void {
        $role     = $this->makeRole('AttachRoleA');
        $approver = $this->makeUser('AttachApprover');
        $this->assignRole($approver, $role);
        $creator = $this->makeUser('AttachCreator');

        $this->makeScheme('scheme-attach', $role);

        PrintTemplate::create([
            'name'           => 'Attach Test Template',
            'name_model'     => 'PdfAttachTestDocument',
            'model'          => PdfAttachTestDocument::class,
            'is_default'     => true,
            'orientation'    => 'portrait',
            'unit'           => 'cm',
            'width'          => 21,
            'height'         => 29.7,
            'html'           => '<html><body><h1>{{doc.code}}</h1></body></html>',
            'used_relations' => [],
        ]);

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc, [
            'controller' => PdfAttachTestDocumentController::class,
            'parameters' => ['pdfAttachTestDocument' => $doc->id],
        ]);
        $step = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->first();

        $response = $this->approveViaHttp($approver, $step);

        $this->assertNotEquals(500, $response->getStatusCode(), (string) $response->getContent());
        $this->assertEquals(FormStatus::APPROVED->value, $instance->fresh()->status->value);

        $fileable = Fileable::where('fileable_id', $doc->id)
            ->where('fileable_type', PdfAttachTestDocument::class)
            ->first();

        $this->assertNotNull($fileable, 'Expected a Fileable record to be created for the approved document');
        $this->assertSame('application/pdf', $fileable->file->mime_type);
        $this->assertTrue($fileable->is_generated_pdf);
    }

    public function test_approval_stays_approved_even_when_pdf_generation_throws(): void {
        $role     = $this->makeRole('FailRoleA');
        $approver = $this->makeUser('FailApprover');
        $this->assignRole($approver, $role);
        $creator = $this->makeUser('FailCreator');

        $this->makeScheme('scheme-fail', $role);

        PrintTemplate::create([
            'name'           => 'Fail Test Template',
            'name_model'     => 'PdfAttachTestDocument',
            'model'          => PdfAttachTestDocument::class,
            'is_default'     => true,
            'orientation'    => 'portrait',
            'unit'           => 'cm',
            'width'          => 21,
            'height'         => 29.7,
            'html'           => '<html><body>{{doc.code}}</body></html>',
            'used_relations' => [],
        ]);

        $this->mock(PdfExportService::class, function ($mock) {
            $mock->shouldReceive('generate')->andThrow(new \RuntimeException('wkhtmltopdf exploded'));
        });

        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc, [
            'controller' => PdfAttachTestDocumentController::class,
            'parameters' => ['pdfAttachTestDocument' => $doc->id],
        ]);
        $step = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->first();

        $response = $this->approveViaHttp($approver, $step);

        $this->assertNotEquals(500, $response->getStatusCode(), (string) $response->getContent());
        $this->assertEquals(FormStatus::APPROVED->value, $instance->fresh()->status->value);
        $this->assertEquals('approved', $doc->fresh()->status);

        $this->assertNull(Fileable::where('fileable_id', $doc->id)->first());
    }

    public function test_approval_completes_without_attach_when_no_default_print_template(): void {
        $role     = $this->makeRole('NoTplRoleA');
        $approver = $this->makeUser('NoTplApprover');
        $this->assignRole($approver, $role);
        $creator = $this->makeUser('NoTplCreator');

        $this->makeScheme('scheme-notpl', $role);

        // Sengaja TIDAK membuat PrintTemplate untuk model ini.
        $doc      = $this->makeDocument($creator);
        $instance = ApprovalInstance::makeInstance($doc, [
            'controller' => PdfAttachTestDocumentController::class,
            'parameters' => ['pdfAttachTestDocument' => $doc->id],
        ]);
        $step = ApprovalInstanceStep::where('approval_instance_id', $instance->id)->first();

        $response = $this->approveViaHttp($approver, $step);

        $this->assertNotEquals(500, $response->getStatusCode(), (string) $response->getContent());
        $this->assertEquals(FormStatus::APPROVED->value, $instance->fresh()->status->value);
        $this->assertEquals('approved', $doc->fresh()->status);

        $this->assertNull(Fileable::where('fileable_id', $doc->id)->first());
    }
}
